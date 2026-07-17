# Security Rules

These rules are enforced by the lazygrok plugin for all agents and hooks.

## Path safety

- All file operations must stay within the workspace root.
- Symlink escape is rejected.
- Paths outside the workspace require explicit permission.
- No shell interpolation of file paths from untrusted input.

## File safety

- Atomic writes only (temp file + rename).
- File permissions are preserved.
- File size limits are enforced (10 MB max).
- Binary files are rejected by hashline.
- Concurrent writes to the same file are serialized.

## Hook safety

- Hook execution timeouts are enforced.
- Malformed hook input is handled gracefully.
- Unknown event fields are ignored, not crashed on.
- Hooks fail-open except for explicit PreToolUse deny.

## No telemetry

- No prompts, source code, paths, or tool arguments are transmitted externally.
- No machine identifiers or usage events are sent.
- No background HTTP listeners unless explicitly started by the user.
- Diagnostic logs are local only.

## No destructive operations

- No cleanup command deletes unrelated Grok files.
- No recursive deletion of user directories.
- Migration helpers operate only on plugin-owned paths.
- Destructive actions require explicit confirmation.

## State safety

- State files use atomic writes.
- Corrupt state is backed up, not silently discarded.
- Migrations create backups before modifying.
- File locking prevents concurrent corruption.
