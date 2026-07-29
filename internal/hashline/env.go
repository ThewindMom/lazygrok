package hashline

import coreconfig "lazygrok/internal/core/config"

func resolveMode(workspace, grokHome string) (coreconfig.HashlineMode, error) {
	cfg, err := coreconfig.Load(workspace, grokHome)
	if err != nil {
		return coreconfig.HashlineOff, err
	}
	if cfg.NativeMutationStrict && cfg.HashlineMode != coreconfig.HashlineOff {
		return coreconfig.HashlineStrict, nil
	}
	return cfg.HashlineMode, nil
}
