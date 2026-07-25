# Phase 2 + 3 — Hypothesis Formation & Parallel Investigation

One hypothesis is a hunch. Three hypotheses is a decision. Investigation is how you turn the decision into runtime evidence.

---

## Phase 2 — Hypothesis Formation (Minimum Three)

### Why three, not one

A single hypothesis creates confirmation bias: you'll read runtime state looking for evidence that confirms it and unconsciously discount contradictions. Three hypotheses force you to design queries that *distinguish* between them, which is the only way runtime evidence becomes decisive.

### Generate across orthogonal axes

If your three hypotheses are all variations of "the handler has a bug", you don't actually have three hypotheses. Span the space:

| Axis | Example framing |
|---|---|
| **User-code logic** | "The handler early-returns because condition X is unexpectedly true" |
| **Library/SDK behavior** | "The third-party client swallows the error and returns a stub" |
| **Environment/config** | "The env var is read at module-load time before it gets populated, so it's empty" |
| **Async/timing** | "The promise rejects (or goroutine panics) after the response is already sent" |
| **Silent side-effect** | "An earlier turn mutated shared state that the current turn inherits" |
| **Observability gap** | "The error is raised but suppressed before logging; it only exists as an unawaited rejection / ignored signal" |
| **Binary-level** (when applicable) | "The function we think is running is actually jumped over by a patched thunk / a different version loaded" |
| **Build-vs-runtime** | "The code we're reading is not the code that's running — stale build, wrong symlink, cached wheel, or dist/ ahead of src/" |

### For each hypothesis, write in the journal

1. **Claim** — one sentence.
2. **Distinguishing evidence** — the exact value or state that confirms or refutes it, AND where to read it (file:line, log source, breakpoint location, memory address).
3. **If true, the fix is** — two words. Forces you to think through fix cost before committing to the hunt.

### Collapse rule

If two hypotheses have identical distinguishing evidence, they aren't actually different — collapse them and find a real alternative. If you can't come up with a third distinct hypothesis, you don't understand the system well enough yet. Go read a little more code before investigating.

---

## Phase 3 — Parallel Investigation

Branch depending on what's available.

### Path A: Parallel investigation (Grok default)

`team_*` tools are **n/a on Grok**. When you have ≥3 hypotheses and any of them would take >10 minutes to investigate single-threaded, fan out **parallel `spawn_subagent` workers** and keep the journal in the Lead. Prefer state under `.lazygrok/` (not `~/.omo/teams/`).

**Worker roles** — spawn one background subagent per evidence lane (cap ~4 concurrent):

```
spawn_subagent(subagent_type="lazygrok:explore", background=true,
     prompt="TASK: Runtime State Inspector for hypothesis set. DELIVERABLE: observed values verbatim with file:line / address refs. SCOPE: attach to the live process, hit breakpoints, read program state (variables, heap, goroutines, stack, registers depending on runtime). VERIFY: never guess — if you don't see the value, say so. Never edit source code. Never run git commands. If you need instrumentation (breakpoint(), debugger;, dbg!, etc.), report the request instead of applying it.")

spawn_subagent(subagent_type="lazygrok:explore", background=true,
     prompt="TASK: Log Archaeologist. DELIVERABLE: timeline of events with latencies and silent-failure flags. SCOPE: grep server logs, stderr streams, SDK-internal debug output (DEBUG env, RUST_LOG, GODEBUG, PYTHONASYNCIODEBUG), correlate timestamps. VERIFY: flag silent catch, swallowed rejection, recovered-and-ignored panic, success-with-failure-signals (HTTP 200 empty body, stopReason=error, exit 0 with error-in-stdout). Never edit source code.")

spawn_subagent(subagent_type="lazygrok:hephaestus", background=true,
     prompt="TASK: Reproduction Engineer. DELIVERABLE: smallest reliable repro (curl / vitest/pytest/go test / tmux / Playwright / pwntools) that reproduces on first try. SCOPE: document exact input, expected output, observed output; save repro artifacts under /tmp/. VERIFY: if browser-based MUST use Playwright — do not simulate with curl. Never git commit.")

spawn_subagent(subagent_type="lazygrok:oracle", background=true,
     prompt="TASK: Trace Correlator. DELIVERABLE: causal chain + missing evidence + single most-decisive next runtime query. SCOPE: reason across already-captured evidence only (Lead will paste member findings). VERIFY: if hypotheses diverge sharply after correlation, flag Oracle Triple. Never edit source code.")
```

**Assignment rule**: one hypothesis → one `spawn_subagent`. Give each hypothesis to the worker whose evidence source is most likely to confirm or refute it. Put the full hypothesis list in every worker's prompt so they know what the others are testing.

**Lead responsibilities**:
- Maintain the journal (workers do not write to it).
- Approve any source-code edits (including `debugger;` / `breakpoint()` / `dbg!` statements).
- Poll with `get_command_or_subagent_output(task_ids=[...])`; a timeout only means no new output.
- Synthesize worker reports into updated hypothesis statuses.
- Kill residual workers with `kill_command_or_subagent` when the round ends.

**Oracle Triple stays separate** — Phase 4 (see `04-oracle-triple.md`) spawns three `lazygrok:oracle` agents; do not fold the Triple into the investigation fan-out above.

### Path B: Lightweight fan-out (few/short hypotheses)

Same rule: one hypothesis per subagent when a full four-lane split is overkill.

```
spawn_subagent(subagent_type="lazygrok:explore", background=true,
     prompt="TASK: Runtime state investigation for hypothesis 1. DELIVERABLE: confirming/refuting evidence. SCOPE: [CONTEXT: bug summary + which hypothesis you own + what state to look at]")
spawn_subagent(subagent_type="lazygrok:explore", background=true,
     prompt="TASK: Log/timing investigation for hypothesis 2. DELIVERABLE: timeline + flags. SCOPE: ...")
spawn_subagent(subagent_type="lazygrok:hephaestus", background=true,
     prompt="TASK: Reproduction minimizer for hypothesis 3. DELIVERABLE: smallest reliable repro. SCOPE: ...")
```

Collect with `get_command_or_subagent_output(task_ids=[...])`, then synthesize.

---

## Evidence capture discipline (both paths)

For every piece of runtime state captured, record in the journal:

```markdown
### <ISO timestamp> — <what you looked at>
- Source: <file:line | log source | curl command | breakpoint address>
- Value: `<verbatim>`
- Interpretation: <one line — why this matters>
- Refutes/Confirms: H<n>
```

**Verbatim values only. No paraphrasing.**

- `messages.length=0` is evidence.
- "messages seemed empty" is not evidence — it's a memory of an observation, and memory of observations is where debug sessions go to die.

If you find yourself about to paraphrase, stop, go back, and copy the raw value.

---

## Round completion

A "round" is complete when every hypothesis has either confirming or refuting evidence — or when you have exhausted the evidence sources available without a decisive result. If the round ends inconclusively, that counts as a failed round for the counter in the journal. See `04-oracle-triple.md` for what to do at 2 consecutive failed rounds.
