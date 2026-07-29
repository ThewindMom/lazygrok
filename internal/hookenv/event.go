package hookenv

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
)

const MaxEventBytes int64 = 1 << 20

var (
	ErrEventTooLarge    = errors.New("hook event exceeds size limit")
	ErrInvalidSessionID = errors.New("invalid session ID")
)

// Event is the subset of Grok hook stdin JSON used across subcommands.
type Event struct {
	SessionID            string
	WorkspaceRoot        string
	ToolName             string
	ToolInput            map[string]any
	Prompt               string
	StopReason           string
	HookEventName        string
	LastAssistantMessage string
	StopHookActive       bool
	BackgroundTasks      []map[string]any
}

type rawEvent map[string]any

func ReadEvent(r io.Reader) (Event, error) {
	limited := &io.LimitedReader{R: r, N: MaxEventBytes + 1}
	decoder := json.NewDecoder(limited)
	var raw rawEvent
	if err := decoder.Decode(&raw); err != nil {
		if limited.N == 0 {
			return Event{}, ErrEventTooLarge
		}
		return Event{}, err
	}
	var trailing json.RawMessage
	if err := decoder.Decode(&trailing); err != io.EOF {
		if limited.N == 0 {
			return Event{}, ErrEventTooLarge
		}
		if err == nil {
			return Event{}, errors.New("hook event contains multiple JSON values")
		}
		return Event{}, err
	}
	if limited.N == 0 {
		return Event{}, ErrEventTooLarge
	}
	sessionID, err := ParseSessionID(pickString(raw, "sessionId", "session_id"))
	if err != nil {
		return Event{}, err
	}
	return Event{
		SessionID:            sessionID,
		WorkspaceRoot:        WorkspaceFromRaw(raw),
		ToolName:             pickString(raw, "toolName", "tool_name", "tool"),
		ToolInput:            pickMap(raw, "toolInput", "tool_input", "input", "arguments", "rawInput"),
		Prompt:               pickString(raw, "prompt", "userPrompt", "user_prompt", "message"),
		StopReason:           pickString(raw, "stopReason", "stop_reason", "stop_reason_code"),
		HookEventName:        pickString(raw, "hookEventName", "hook_event_name"),
		LastAssistantMessage: pickString(raw, "last_assistant_message", "lastAssistantMessage", "last_assistant_message_text"),
		StopHookActive:       pickBool(raw, "stop_hook_active", "stopHookActive"),
		BackgroundTasks:      pickTaskList(raw, "background_tasks", "backgroundTasks"),
	}, nil
}

func ParseSessionID(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	if len(value) > 128 {
		return "", fmt.Errorf("%w: length exceeds 128 bytes", ErrInvalidSessionID)
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') ||
			(r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') ||
			r == '-' ||
			r == '_' {
			continue
		}
		return "", fmt.Errorf("%w: unsupported character %q", ErrInvalidSessionID, r)
	}
	return value, nil
}

func pickBool(m map[string]any, keys ...string) bool {
	for _, k := range keys {
		v, ok := m[k]
		if !ok {
			continue
		}
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

func pickTaskList(m map[string]any, keys ...string) []map[string]any {
	for _, k := range keys {
		v, ok := m[k]
		if !ok {
			continue
		}
		arr, ok := v.([]any)
		if !ok {
			continue
		}
		out := make([]map[string]any, 0, len(arr))
		for _, item := range arr {
			if mm, ok := item.(map[string]any); ok {
				out = append(out, mm)
			}
		}
		return out
	}
	return nil
}

func pickString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		v, ok := m[k]
		if !ok {
			continue
		}
		s, ok := v.(string)
		if ok && s != "" {
			return s
		}
	}
	return ""
}

func pickMap(m map[string]any, keys ...string) map[string]any {
	for _, k := range keys {
		v, ok := m[k]
		if !ok {
			continue
		}
		if mm, ok := v.(map[string]any); ok {
			return mm
		}
	}
	return nil
}
