package hashline

import "lazygrok/internal/config"

// Enabled reports whether hashline guards are active (LAZYGROK_HASHLINE, default on).
func Enabled() bool {
	return config.HashlineEnabled()
}