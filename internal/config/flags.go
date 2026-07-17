package config

import (
	"os"
	"strings"
)

func envTruthy(key string, defaultOn bool) bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if v == "" {
		return defaultOn
	}
	switch v {
	case "0", "false", "no", "off":
		return false
	case "1", "true", "yes", "on":
		return true
	default:
		return defaultOn
	}
}

func envTruthyOff(key string) bool {
	return envTruthy(key, true)
}

// HashlineEnabled reports LAZYGROK_HASHLINE (default on).
func HashlineEnabled() bool {
	return envTruthyOff("LAZYGROK_HASHLINE")
}

// IntentGateEnabled reports LAZYGROK_INTENT_GATE (default on).
func IntentGateEnabled() bool {
	return envTruthyOff("LAZYGROK_INTENT_GATE")
}

// LSPEnforceEnabled reports LAZYGROK_LSP_ENFORCE (default on).
func LSPEnforceEnabled() bool {
	return envTruthyOff("LAZYGROK_LSP_ENFORCE")
}

// PlanModeForced reports LAZYGROK_PLAN_MODE force-on.
func PlanModeForced() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("LAZYGROK_PLAN_MODE"))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}