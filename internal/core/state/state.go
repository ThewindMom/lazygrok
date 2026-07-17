// Package state provides atomic, versioned, file-locked persistence for
// lazygrok state files. It supports schema migrations, corruption recovery,
// and session/workspace scoping.
//
// State files are JSON with a schemaVersion field. Writes are atomic:
// data is written to a temporary file in the same directory, then renamed.
// A per-file lock prevents concurrent corruption.
package state

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// CurrentSchemaVersion is the latest state schema version.
const CurrentSchemaVersion = 2

// File is the top-level envelope for all persisted state files.
type File struct {
	SchemaVersion int            `json:"schemaVersion"`
	UpdatedAt     string         `json:"updatedAt"`
	Data          map[string]any `json:"data"`
}

// mu protects per-path locks.
var (
	lockMu sync.Mutex
	locks  = map[string]*sync.Mutex{}
)

// pathLock returns a mutex for a given file path, creating one if needed.
func pathLock(path string) *sync.Mutex {
	lockMu.Lock()
	defer lockMu.Unlock()
	if m, ok := locks[path]; ok {
		return m
	}
	m := &sync.Mutex{}
	locks[path] = m
	return m
}

// Write atomically writes data as JSON to path.
// It creates parent directories, writes to a temp file, then renames.
// The temp file is in the same directory to ensure atomic rename.
func Write(path string, data []byte) error {
	mu := pathLock(path)
	mu.Lock()
	defer mu.Unlock()

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}

	tmp, err := os.CreateTemp(dir, ".lazygrok-tmp-*")
	if err != nil {
		return fmt.Errorf("create temp: %w", err)
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath) // cleanup if rename fails

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return fmt.Errorf("write temp: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync temp: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close temp: %w", err)
	}

	// Preserve permissions of existing file if present
	if info, err := os.Stat(path); err == nil {
		_ = os.Chmod(tmpPath, info.Mode())
	}

	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("rename: %w", err)
	}
	return nil
}

// WriteJSON marshals v to JSON and writes it atomically.
func WriteJSON(path string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}
	data = append(data, '\n')
	return Write(path, data)
}

// Read reads and returns the raw bytes from path.
func Read(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// ReadJSON reads path and unmarshals into v.
func ReadJSON(path string, v any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// ReadWithBackup reads a state file. If JSON parsing fails, it backs up the
// corrupt file with a timestamp suffix and returns the backup path so the
// caller can report it. The returned error is the original parse error.
func ReadWithBackup(path string) (data []byte, backupPath string, err error) {
	data, err = os.ReadFile(path)
	if err != nil {
		return nil, "", err
	}
	// Verify it's valid JSON
	var probe any
	if jerr := json.Unmarshal(data, &probe); jerr != nil {
		backupPath = path + ".corrupt." + time.Now().UTC().Format("20060102-150405")
		_ = os.WriteFile(backupPath, data, 0o644)
		return data, backupPath, fmt.Errorf("corrupt JSON (backed up to %s): %w", backupPath, jerr)
	}
	return data, "", nil
}

// Migrate checks the schema version and applies migrations if needed.
// It reads the file, checks schemaVersion, applies migrations, and writes back.
// If the file doesn't exist, it returns nil (no migration needed).
func Migrate(path string, migrations map[int]func(map[string]any) map[string]any) error {
	mu := pathLock(path)
	mu.Lock()
	defer mu.Unlock()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("cannot migrate unparseable file: %w", err)
	}

	version := 1
	if v, ok := raw["schemaVersion"].(float64); ok {
		version = int(v)
	}

	changed := false
	for version < CurrentSchemaVersion {
		migrateFn, ok := migrations[version]
		if !ok {
			break
		}
		raw = migrateFn(raw)
		version++
		changed = true
	}

	if !changed {
		return nil
	}

	raw["schemaVersion"] = version
	raw["updatedAt"] = time.Now().UTC().Format(time.RFC3339)
	out, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')

	// Backup before overwriting
	backup := path + ".pre-migration." + time.Now().UTC().Format("20060102-150405")
	_ = os.WriteFile(backup, data, 0o644)

	return os.WriteFile(path, out, 0o644)
}

// LockPath returns the lock file path for a given state file.
// (Used for advisory file locking via flock if needed in the future.)
func LockPath(path string) string {
	return path + ".lock"
}
