package cmd

import (
	"fmt"
	"os"
	"runtime"

	"lazygrok/internal/core/rules"
	"lazygrok/internal/hookenv"
	"lazygrok/internal/hookio"
	"lazygrok/internal/skillgate"
	"lazygrok/internal/usingpowers"
	"github.com/spf13/cobra"
)

func sessionStartCmd() *cobra.Command {
	return &cobra.Command{
		Use: "session-start",
		RunE: func(cmd *cobra.Command, args []string) error {
			ev, err := readEvent()
			if err != nil {
				return err
			}
			hookenv.ApplyEvent(ev)
			sid := sessionID(ev)
			ws := workspace(ev)

			skillgate.ResetSession(sid)
			usingpowers.ResetSession(sid)
			skillgate.RefreshCatalog(sid, ws)

			if warn := hookBinaryDoctor(); warn != "" {
				fmt.Fprintln(os.Stderr, warn)
			}

			msg := skillgate.BuildSessionContextMessage(sid, 20)
			if msg != "" {
				hookio.EmitAdditionalContext(os.Stdout, msg, "SessionStart")
			}

			// Inject project rules discovered by the core/rules engine.
			engine := rules.NewEngine()
			rulesText, diags := engine.LoadAndFormat(ws, ws)
			for _, d := range diags {
				fmt.Fprintf(os.Stderr, "lazygrok-hook: rules %s: %s\n", d.Severity, d.Message)
			}
			if rulesText != "" {
				hookio.EmitAdditionalContext(os.Stdout, rulesText, "SessionStart")
			}
			return nil
		},
	}
}

func hookBinaryDoctor() string {
	root, err := hookenv.PluginRoot()
	if err != nil {
		return ""
	}
	goos := runtime.GOOS
	goarch := runtime.GOARCH
	switch goarch {
	case "amd64":
	case "arm64":
	default:
		return fmt.Sprintf("lazygrok-hook: unsupported arch %s — rebuild with scripts/build-hook.sh", goarch)
	}
	var name string
	switch goos {
	case "linux":
		name = fmt.Sprintf("lazygrok-hook-linux-%s", goarch)
	case "darwin":
		name = fmt.Sprintf("lazygrok-hook-darwin-%s", goarch)
	case "windows":
		name = "lazygrok-hook-windows-amd64.exe"
	default:
		return fmt.Sprintf("lazygrok-hook: unsupported OS %s", goos)
	}
	path := fmt.Sprintf("%s/bin/%s", root, name)
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Sprintf("lazygrok-hook: missing or unreadable hook binary: %s (run scripts/build-hook.sh)", path)
	}
	if info.Mode()&0o111 == 0 {
		return fmt.Sprintf("lazygrok-hook: hook binary not executable: %s (chmod +x)", path)
	}
	return ""
}