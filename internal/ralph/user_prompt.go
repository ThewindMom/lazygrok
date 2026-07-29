package ralph

import (
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"lazygrok/internal/hookenv"
	"lazygrok/internal/skillgate"
)

var cancelRE = regexp.MustCompile(`(?i)^/?cancel-ralph\b`)

// CollectUserPrompt handles legacy Ralph commands on UserPromptSubmit.
func CollectUserPrompt(ev hookenv.Event) string {
	ws := hookenv.Workspace(ev)
	if ws == "" {
		return ""
	}
	prompt := strings.TrimSpace(ev.Prompt)
	if prompt == "" {
		return ""
	}
	path := StatePath(ws)
	sid := ev.SessionID

	if cancelRE.MatchString(prompt) {
		cleared, err := clearStateForSession(path, sid)
		if err != nil {
			if errors.Is(err, ErrSessionMismatch) {
				return "<RALPH_LOOP>Cancellation ignored: the active Ralph loop belongs to another session.</RALPH_LOOP>"
			}
			return "<RALPH_LOOP>Unable to cancel safely: Ralph state could not be cleared and remains active.</RALPH_LOOP>"
		}
		if !cleared {
			return "<RALPH_LOOP>No active Ralph loop for this workspace.</RALPH_LOOP>"
		}
		return "<RALPH_LOOP>Canceled active Ralph loop. Cleared " + stateRelPath + ".</RALPH_LOOP>"
	}

	args := parseLoopArgs(prompt)
	if args == nil || args.Task == "" {
		if matchedLoopCommand(prompt) {
			return `<RALPH_LOOP>Provide a task. Examples:
/ralph-loop "fix bug"</RALPH_LOOP>`
		}
		return ""
	}
	if sid == "" {
		return "<RALPH_LOOP>Unable to start safely: this event has no session ID.</RALPH_LOOP>"
	}

	st := &state{
		Active:                   true,
		Iteration:                1,
		MaxIterations:            args.MaxIterations,
		CompletionPromise:        args.CompletionPromise,
		InitialCompletionPromise: args.CompletionPromise,
		SessionID:                sid,
		Strategy:                 args.Strategy,
		StartedAt:                time.Now().UTC().Format(time.RFC3339),
		Prompt:                   args.Task,
		Ultrawork:                args.Ultrawork,
	}
	if err := withStateLock(path, func() error {
		existing, exists, err := stateForMutation(path)
		if err != nil {
			return err
		}
		if exists && !sessionOwnsState(existing, sid) {
			return ErrSessionMismatch
		}
		return writeState(path, st)
	}); err != nil {
		return ""
	}
	skillName := "ralph-loop"
	if args.Ultrawork {
		skillName = "ulw-ralph-loop"
	}
	_ = skillgate.MarkSkillLoaded(sid, skillName)
	context := ralphLoopTemplate(st.MaxIterations, st.CompletionPromise)
	if args.Ultrawork {
		context += "\nThis explicit Ultrawork Ralph variant requires verified completion before the promise is accepted.\n"
	}
	return strings.TrimSpace(context + "\n" + args.Task)
}

type loopArgs struct {
	Task              string
	CompletionPromise string
	MaxIterations     int
	Strategy          string
	Ultrawork         bool
}

func matchedLoopCommand(prompt string) bool {
	re := regexp.MustCompile(`(?i)^/?(?:ralph-loop|ulw-ralph-loop)(?:\s|$)`)
	return re.MatchString(prompt)
}

func parseLoopArgs(text string) *loopArgs {
	text = strings.TrimSpace(text)
	m := regexp.MustCompile(`(?is)^/?(ralph-loop|ulw-ralph-loop)(?:\s+|$)(.*)$`).FindStringSubmatch(text)
	if m == nil {
		return nil
	}
	ultrawork := strings.EqualFold(m[1], "ulw-ralph-loop")
	rest := strings.TrimSpace(m[2])

	cp := os.Getenv("RALPH_DEFAULT_COMPLETION_PROMISE")
	if cp == "" {
		cp = "DONE"
	}
	maxIt := defaultMaxIterations(ultrawork)
	strategy := "continue"

	cpRE := regexp.MustCompile(`(?i)--completion-promise=(\S+)`)
	maxRE := regexp.MustCompile(`(?i)--max-iterations=(\d+)`)
	stratRE := regexp.MustCompile(`(?i)--strategy=(reset|continue)`)
	if fm := cpRE.FindStringSubmatch(rest); len(fm) > 1 {
		cp = fm[1]
		rest = cpRE.ReplaceAllString(rest, "")
	}
	if fm := maxRE.FindStringSubmatch(rest); len(fm) > 1 {
		if n, err := strconv.Atoi(fm[1]); err == nil {
			maxIt = n
		}
		rest = maxRE.ReplaceAllString(rest, "")
	}
	if fm := stratRE.FindStringSubmatch(rest); len(fm) > 1 {
		strategy = strings.ToLower(fm[1])
		rest = stratRE.ReplaceAllString(rest, "")
	}
	rest = strings.TrimSpace(rest)

	task := rest
	if len(rest) > 0 && (rest[0] == '"' || rest[0] == '\'') {
		q := rest[0]
		if end := strings.Index(rest[1:], string(q)); end >= 0 {
			task = rest[1 : 1+end]
		} else {
			task = strings.Trim(rest, string(q))
		}
	}

	return &loopArgs{
		Task:              task,
		CompletionPromise: cp,
		MaxIterations:     maxIt,
		Strategy:          strategy,
		Ultrawork:         ultrawork,
	}
}

func ralphLoopTemplate(maxIt int, promise string) string {
	return fmt.Sprintf(`You are in a **Ralph Loop** — a self-referential development loop that runs until the task is complete.

## How it works

1. Work on the task continuously until it is **fully** done.
2. When complete, output exactly: <promise>%s</promise>
3. If you stop without that tag, the Stop hook injects a continuation prompt.
4. Maximum iterations: %d.

## Rules

- Finish the whole task, not a partial slice.
- Do not emit the completion promise until the work is truly complete.
- Use todos to track multi-step work.

## Cancel

/cancel-ralph

## Your task

`, promise, maxIt)
}
