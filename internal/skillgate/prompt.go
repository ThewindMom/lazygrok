package skillgate

import (
	"fmt"
	"sort"
	"strings"
	"unicode"

	"github.com/mihazs/oh-my-grok/internal/hookenv"
)

const grokComposerPreamble = `Grok Composer: There is no Skill tool. The harness may show <skill_information> with skill names and paths — that is metadata only, not loaded skill content.
Before Grep, Shell, Write, StrReplace, Task, or other tools, use Read on each applicable SKILL.md path from the catalog below.
Announce: Using <skill-name> to <purpose> after each Read.`

var stopWords = map[string]struct{}{
	"about": {}, "after": {}, "also": {}, "and": {}, "any": {}, "are": {}, "asked": {},
	"before": {}, "can": {}, "could": {}, "fix": {}, "for": {}, "from": {}, "have": {},
	"help": {}, "how": {}, "into": {}, "just": {}, "need": {}, "not": {}, "please": {},
	"should": {}, "that": {}, "the": {}, "their": {}, "them": {}, "then": {}, "there": {},
	"this": {}, "user": {}, "want": {}, "what": {}, "when": {}, "which": {}, "will": {},
	"with": {}, "would": {}, "your": {},
}

// EnsureCatalog refreshes the session catalog when empty (SessionStart may not have run).
func EnsureCatalog(sessionID, workspace string) {
	if catalogCount(sessionID) > 0 {
		return
	}
	RefreshCatalog(sessionID, workspace)
}

// CollectForPrompt returns proactive skill-loading context for UserPromptSubmit.
func CollectForPrompt(sessionID string, ev hookenv.Event) string {
	ws := hookenv.Workspace(ev)
	EnsureCatalog(sessionID, ws)

	catalog := loadCatalog(sessionID)
	loaded := loadLoadedIDs(sessionID)
	prompt := strings.TrimSpace(ev.Prompt)

	var parts []string
	parts = append(parts, "<AGENT_SKILL_GATE_PROACTIVE>", grokComposerPreamble)

	if strings.Contains(prompt, "<skill_information>") || strings.Contains(prompt, "skills_referenced") {
		parts = append(parts,
			"",
			"WARNING: This turn includes skill_information references. Those are not substitutes for Read — load full SKILL.md files now.",
		)
	}

	if len(catalog) == 0 {
		meta := metaSkillPath()
		if meta == "" {
			meta = RulesPath()
		}
		parts = append(parts, "",
			"Catalog empty — run `grok inspect` or Read: "+meta,
			"</AGENT_SKILL_GATE_PROACTIVE>",
		)
		return strings.Join(parts, "\n")
	}

	matches := matchUnloadedSkills(prompt, catalog, loaded, 8)
	if len(loaded) == 0 {
		parts = append(parts, "",
			"MANDATORY: No catalog skills loaded yet. Read at least one applicable skill before any other tool.",
		)
	}
	if len(matches) > 0 {
		parts = append(parts, "", "Likely applicable (Read these paths first):")
		for _, m := range matches {
			desc := strings.ReplaceAll(m.Description, "\n", " ")
			if len(desc) > 100 {
				desc = desc[:100] + "..."
			}
			parts = append(parts, fmt.Sprintf("- %s → Read `%s` — %s", m.ID, m.Path, desc))
		}
	} else if len(loaded) == 0 {
		shown := 0
		parts = append(parts, "", "Browse catalog (Read path for any that apply):")
		for _, e := range catalog {
			if e.ID == "" || e.Path == "" {
				continue
			}
			if _, ok := loaded[e.ID]; ok {
				continue
			}
			parts = append(parts, fmt.Sprintf("- %s → `%s`", e.ID, e.Path))
			shown++
			if shown >= 6 {
				break
			}
		}
	}

	parts = append(parts, "", "Rules: "+RulesPath(), "</AGENT_SKILL_GATE_PROACTIVE>")
	return strings.Join(parts, "\n")
}

type scoredEntry struct {
	entry catalogEntry
	score int
}

func matchUnloadedSkills(prompt string, catalog []catalogEntry, loaded map[string]struct{}, limit int) []catalogEntry {
	if strings.TrimSpace(prompt) == "" {
		return nil
	}
	words := promptTokens(prompt)
	if len(words) == 0 {
		return nil
	}
	var scored []scoredEntry
	for _, e := range catalog {
		if e.ID == "" || e.Path == "" {
			continue
		}
		if _, ok := loaded[e.ID]; ok {
			continue
		}
		s := scoreEntry(words, e)
		if s > 0 {
			scored = append(scored, scoredEntry{e, s})
		}
	}
	sort.Slice(scored, func(i, j int) bool {
		if scored[i].score != scored[j].score {
			return scored[i].score > scored[j].score
		}
		return scored[i].entry.ID < scored[j].entry.ID
	})
	if limit <= 0 {
		limit = 8
	}
	out := make([]catalogEntry, 0, limit)
	for i := 0; i < len(scored) && i < limit; i++ {
		out = append(out, scored[i].entry)
	}
	return out
}

func promptTokens(prompt string) []string {
	prompt = stripCodeForMatch(prompt)
	var words []string
	for _, f := range strings.FieldsFunc(strings.ToLower(prompt), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '-' && r != '_'
	}) {
		f = strings.Trim(f, "-_")
		if len(f) < 4 {
			continue
		}
		if _, skip := stopWords[f]; skip {
			continue
		}
		words = append(words, f)
	}
	return words
}

func stripCodeForMatch(s string) string {
	if idx := strings.Index(s, "<user_query>"); idx >= 0 {
		s = s[idx:]
	}
	return s
}

func scoreEntry(words []string, e catalogEntry) int {
	hay := strings.ToLower(e.ID + " " + e.Description)
	hay = strings.ReplaceAll(hay, "-", " ")
	score := 0
	for _, w := range words {
		wDash := strings.ReplaceAll(w, "_", "-")
		if strings.Contains(hay, w) || strings.Contains(hay, wDash) {
			score++
		}
	}
	// Slash commands and explicit skill names in prompt.
	pLower := strings.ToLower(strings.Join(words, " "))
	if strings.Contains(pLower, strings.ReplaceAll(e.ID, "-", " ")) {
		score += 3
	}
	if strings.Contains(pLower, e.ID) {
		score += 3
	}
	return score
}