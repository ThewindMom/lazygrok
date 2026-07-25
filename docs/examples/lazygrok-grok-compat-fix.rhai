let meta = #{
    name: "lazygrok-grok-compat-fix",
    description: "Apply all Grok-compat fixes from the audit (P0–P4) in parallel, then verify",
    when_to_use: "After lazygrok-grok-compat-audit when applying remaining Task/TodoWrite/Codex renames",
    phases: [
        #{ title: "Fix", detail: "parallel write shards for skills/commands/agents" },
        #{ title: "Verify", detail: "grep residual foreign APIs and confirm high-priority files" },
        #{ title: "Synthesize", detail: "write fix receipt" },
    ],
};

let shard_result_schema = #{
    "type": "object",
    "required": ["shard", "files_changed", "status", "notes"],
    "properties": #{
        "shard": #{ "type": "string" },
        "status": #{ "type": "string" },
        "notes": #{ "type": "string" },
        "files_changed": #{
            "type": "array",
            "maxItems": 40,
            "items": #{ "type": "string" },
        },
        "skipped": #{
            "type": "array",
            "maxItems": 20,
            "items": #{ "type": "string" },
        },
    },
};

let verify_schema = #{
    "type": "object",
    "required": ["clean", "residual_hits", "summary"],
    "properties": #{
        "clean": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "residual_hits": #{
            "type": "array",
            "maxItems": 40,
            "items": #{
                "type": "object",
                "required": ["path", "pattern", "severity", "note"],
                "properties": #{
                    "path": #{ "type": "string" },
                    "pattern": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                    "note": #{ "type": "string" },
                },
            },
        },
    },
};

let receipt_schema = #{
    "type": "object",
    "required": ["title", "markdown"],
    "properties": #{
        "title": #{ "type": "string" },
        "markdown": #{ "type": "string" },
    },
};

let plugin_root = if args == () { () } else { args.plugin_root };
if plugin_root == () {
    pause("verification", "Pass args.plugin_root — absolute path to lazygrok plugin install");
}

let rules = "";
rules += "GROK NATIVE TOOLS: read_file, write, search_replace, list_dir, grep, run_terminal_command, ";
rules += "todo_write, spawn_subagent, get_command_or_subagent_output, kill_command_or_subagent, ";
rules += "web_search, web_fetch, open_page, workflow.\n";
rules += "RENAMES: Task/task()->spawn_subagent; TodoWrite->todo_write; Bash/bash()->run_terminal_command; ";
rules += "Write->write; Edit/StrReplace->search_replace; Read->read_file; Skill tool->read_file on SKILL.md; ";
rules += "webfetch->web_fetch/open_page; rg/glob body language may say grep/list_dir.\n";
rules += "PATHS: prefer .lazygrok/ over .omo/ for Grok-facing state (plans, evidence, boulder).\n";
rules += "AGENT TYPES: metis-consultant->lazygrok:metis or metis; momus-reviewer->lazygrok:momus or momus; ";
rules += "code-reviewer->lazygrok:lazygrok-code-reviewer; explore->lazygrok:explore or explore; ";
rules += "librarian->lazygrok:librarian or librarian.\n";
rules += "DO NOT change unrelated prose. DO NOT invent tools. Preserve skill frontmatter name/description.\n";
rules += "After edits, re-read changed sections and fix any leftover foreign names in YOUR shard files only.\n";
rules += "Use absolute paths under PLUGIN_ROOT. capability is write — apply search_replace/write yourself.\n";

// --- Fix shards ---
let shards = [
    #{
        id: "p0-ulw-plan",
        brief: "P0: commands/ulw-loop.md, skills/ulw-loop/SKILL.md, skills/prometheus-plan/SKILL.md",
        detail: "1) REWRITE commands/ulw-loop.md to match skills/ulw-loop: /ulw-loop start syntax, max-iterations 500, flow with <promise>DONE</promise> then spawn verifier lazygrok:lazygrok-code-reviewer (or oracle) that ends with <promise>VERIFIED</promise>, cancel with /cancel-ralph (not /stop-continuation as primary), state .lazygrok/ralph-loop.local.md. Keep YAML frontmatter description. 2) skills/ulw-loop/SKILL.md: change default verifier from code-reviewer to lazygrok:lazygrok-code-reviewer; show spawn_subagent example; keep VERIFIED promise. 3) skills/prometheus-plan/SKILL.md: replace Task(subagent_type=...) with spawn_subagent(subagent_type=...); metis-consultant->lazygrok:metis; momus-reviewer->lazygrok:momus; explore/librarian keep types; Write+Edit->write/search_replace; keep .lazygrok paths.",
    },
    #{
        id: "p1-reviewers",
        brief: "P1: three reviewer agents evidence write path",
        detail: "Edit agents/lazygrok-code-reviewer.md, agents/lazygrok-gate-reviewer.md, agents/lazygrok-clone-fidelity-reviewer.md. Add write to tools array (keep read_file grep list_dir). Change report path .omo/evidence/ to .lazygrok/evidence/. Say: prefer writing the report file; if write fails, put full report in the return message. Replace Skill-tool loading language with: Read skills/remove-ai-slops/SKILL.md and programming skill via read_file when available, else apply criteria from this prompt. Keep read-only-for-product-code semantics (do not implement product fixes).",
    },
    #{
        id: "p1-plan-lib-explorer",
        brief: "P1: lazygrok-plan, lazygrok-librarian, explorer agents",
        detail: "1) agents/lazygrok-plan.md: description path .lazygrok/plans/<slug>.md; tools add write (for plan md only). Remove contradiction: either drop spawn_subagent from body and say parent gathers research OR add spawn_subagent to tools. Prefer: tools include write+read tools only; Phase 1 uses direct read_file/grep/list_dir/run_terminal_command only (no spawn). Replace read/rg/lsp_* informal with Grok names. Remove computer_use. Plans under .lazygrok/plans/ not .omo/plans/. 2) agents/lazygrok-librarian.md: tools add web_search if needed; replace webfetch with web_fetch/open_page; keep run_terminal_command for gh. Description: Grok sessions not only Codex. 3) agents/explorer.md: description Grok not Codex; body read->read_file, rg->grep, glob->list_dir; remove omo sparkshell if any.",
    },
    #{
        id: "p2-refactor-debug",
        brief: "P2: vendor refactor + debugging skills",
        detail: "1) vendor/lazygrok-skills/refactor/SKILL.md (and nested refs if they have Task/TodoWrite/bash): rewrite to Grok tools; team_* paths mark as n/a on Grok use parallel spawn_subagent; remove Codex headers that ban spawn_subagent. 2) vendor/lazygrok-skills/debugging/SKILL.md and any methodology references under that skill dir: replace team_*/task(oracle) with spawn_subagent; bash()->run_terminal_command; TodoWrite->todo_write. Grep the skill directory for residual foreign APIs and fix.",
    },
    #{
        id: "p2-vqa-research-start",
        brief: "P2: visual-qa, ultraresearch, vendor start-work",
        detail: "1) vendor/lazygrok-skills/visual-qa/SKILL.md: replace task()/load_skills with spawn_subagent; fix Codex anti-spawn headers; computer_use->playwright MCP or agent-browser; lazycodex agent names to lazygrok. 2) vendor/lazygrok-skills/ultraresearch/SKILL.md: task()->spawn_subagent; drop teammode preference or say Grok: parallel spawn_subagent only. 3) vendor/lazygrok-skills/start-work/SKILL.md: .omo/->.lazygrok/ for plans/boulder/ledger where Grok-facing; computer_use->playwright/agent-browser; codex session wording->Grok session; spawn_subagent is native. Do not break first-party skills/start-work-execution which is already OK.",
    },
    #{
        id: "p3-superpowers",
        brief: "P3: superpowers mechanical renames",
        detail: "In vendor/superpowers/skills fix tool names only: executing-plans (TodoWrite->todo_write); subagent-driven-development (TodoWrite/Task); writing-skills (TodoWrite); using-superpowers (Skill tool->read_file SKILL.md, TodoWrite->todo_write; note agent-skill-gate on Grok); requesting-code-review (Task->spawn_subagent, prefer lazygrok:lazygrok-code-reviewer); dispatching-parallel-agents (Task->spawn_subagent parallel). Keep philosophy text.",
    },
    #{
        id: "p3-tools-gate",
        brief: "P3: hashline-edit, lsp, agent-skill-gate, programming",
        detail: "1) skills/hashline-edit/SKILL.md: StrReplace/Read->search_replace/read_file; mention hashline MCP if present. 2) skills/lsp/SKILL.md and vendor/lazygrok-skills/lsp if duplicate primary is skills/lsp: Write/StrReplace->write/search_replace; CallMcpTool lsp -> lazygrok-lsp / lsp MCP tools. 3) skills/agent-skill-gate/SKILL.md: mutating tools list use write, search_replace, run_terminal_command, spawn_subagent not Write/StrReplace/Shell/task. 4) vendor/lazygrok-skills/programming/SKILL.md: Read->read_file; load skill via read_file path.",
    },
    #{
        id: "p3-branding-lcx",
        brief: "P3: branding, lcx, lsp-setup, ulw-plan",
        detail: "1) vendor/lazygrok-skills/comment-checker and rules: light rebrand Codex->Grok where user-facing without breaking env var names that still work. 2) lcx-report-bug, lcx-contribute-bug-fix: Computer/Browser Use->playwright or agent-browser; $omo:debugging->read_file debugging skill. 3) lsp-setup: add note for Grok .lazygrok or plugin lsp config paths alongside Codex. 4) skills/ulw-plan/SKILL.md: document spawn_subagent, todo_write, .lazygrok paths. 5) skills/ulw-loop already touched by p0 - skip if already fixed.",
    },
    #{
        id: "p4-teammode",
        brief: "P4: teammode mark n_a / gate for Grok",
        detail: "Edit vendor/lazygrok-skills/teammode/SKILL.md (and vendor/omo-skills/teammode/SKILL.md if present and not symlink). Add clear banner at top: ON GROK BUILD this skill is NOT runnable — requires multi_agent_v2/codex_app. Status: n_a/broken on Grok. Alternative: parallel spawn_subagent with self-contained prompts and orchestrator journal. Do not delete the skill; make description say Grok: n/a use parallel spawn_subagent.",
    },
];

phase("Fix");
let jobs = [];
for s in shards {
    let prompt = "";
    prompt += "TASK: Apply Grok Build compatibility fixes to lazygrok plugin files.\n";
    prompt += "You are an implementation agent. Edit files with write/search_replace. Re-read after edits.\n";
    prompt += "PLUGIN_ROOT: ";
    prompt += plugin_root;
    prompt += "\nSHARD: ";
    prompt += s.id;
    prompt += "\nBRIEF: ";
    prompt += s.brief;
    prompt += "\nDETAIL:\n";
    prompt += s.detail;
    prompt += "\n\n";
    prompt += rules;
    prompt += "\nReturn JSON: shard id, status complete|partial|failed, files_changed absolute paths, skipped reasons, notes of what you did.\n";
    prompt += "STOP WHEN: every file in your DETAIL is fixed or explicitly skipped with reason; residual foreign APIs in your files are gone.\n";

    jobs.push(#{
        prompt: prompt,
        label: "fix:" + s.id,
        capability_mode: "read-write",
        output_schema: shard_result_schema,
    });
}

let results = parallel(jobs);
let shard_summaries = [];
let ok = 0;
let bad = 0;
for r in results {
    if r != () && r.success && r.output != () {
        ok += 1;
        shard_summaries.push(r.output);
    } else {
        bad += 1;
    }
}
log("fix shards ok=" + ok.to_string() + " fail=" + bad.to_string());

phase("Verify");
let vp = "";
vp += "TASK: Verify Grok-compat fixes in the lazygrok plugin. Read-only. Use grep and read_file.\n";
vp += "PLUGIN_ROOT: ";
vp += plugin_root;
vp += "\n\nSearch these high-priority paths for residual foreign APIs:\n";
vp += "create_goal, update_goal (OK only if documented as optional host tool),\n";
vp += "Task(subagent, TodoWrite, `Bash`, bash(\", StrReplace as tool name, apply_patch, multi_agent_v2,\n";
vp += "spawn_agent, fork_context, Skill tool, browser:control, computer_use, team_*, .omo/evidence (should be .lazygrok),\n";
vp += "metis-consultant, momus-reviewer, code-reviewer as default without lazygrok prefix in ulw-loop.\n";
vp += "Focus on skills/, commands/, agents/, vendor/lazygrok-skills/, vendor/superpowers/skills/, vendor/omo-skills/teammode.\n";
vp += "Ignore vendor/lazygrok-hooks/ulw-loop Codex-internal create_goal handoff strings if they are CLI protocol for Codex only — note them severity=low.\n";
vp += "Ignore pure historical mentions in docs/lazygrok-grok-compat-report.md.\n";
vp += "For each residual hit that would still mislead a Grok agent: path, pattern, severity high|medium|low, note.\n";
vp += "Set clean=true only if no high residual remains in commands/ulw-loop, prometheus-plan, reviewer agents, teammode banner present.\n";
vp += "Also confirm commands/ulw-loop.md contains <promise>DONE and VERIFIED and /cancel-ralph.\n";
vp += rules;

let ver = agent(vp, #{
    label: "verify-residuals",
    capability_mode: "read-only",
    output_schema: verify_schema,
});

// Optional second pass: fix residual highs if any
if ver != () && ver.success && ver.output != () && ver.output.clean == false {
    let residual = ver.output.residual_hits;
    if residual != () && residual.len() > 0 {
        let fp = "";
        fp += "TASK: Fix residual high/medium Grok-compat hits. Edit only listed files.\n";
        fp += "PLUGIN_ROOT: ";
        fp += plugin_root;
        fp += "\nHITS_JSON:\n";
        fp += json_encode(residual);
        fp += "\n";
        fp += rules;
        fp += "\nFix each high/medium hit. Skip low. Return files_changed.\n";
        let _fix2 = agent(fp, #{
            label: "fix-residuals",
            capability_mode: "read-write",
            output_schema: shard_result_schema,
        });
        log("residual fix pass finished");
    }
}

phase("Synthesize");
let synp = "";
synp += "TASK: Write a short fix receipt markdown for the Grok-compat fix workflow.\n";
synp += "PLUGIN_ROOT: ";
synp += plugin_root;
synp += "\nSHARD_RESULTS_JSON:\n";
synp += json_encode(shard_summaries);
synp += "\nVERIFY_JSON:\n";
if ver != () && ver.success { synp += json_encode(ver.output); } else { synp += "{}"; }
synp += "\nSections: summary counts, files changed by shard, residual issues, recommended commit message.\n";
synp += "Do not invent files not in the JSON.\n";

let syn = agent(synp, #{
    label: "synthesize-receipt",
    capability_mode: "read-only",
    output_schema: receipt_schema,
});

if syn != () && syn.success && syn.output != () && syn.output.markdown != () {
    let p = write_scratch_file("lazygrok-grok-compat-fix-receipt.md", syn.output.markdown);
    complete(#{
        summary: syn.output.title,
        path: p,
        shards_ok: ok,
        shards_fail: bad,
        verify_clean: if ver != () && ver.success && ver.output != () { ver.output.clean } else { false },
    });
}

complete(#{
    summary: "Fix workflow finished without full receipt",
    shards_ok: ok,
    shards_fail: bad,
});
