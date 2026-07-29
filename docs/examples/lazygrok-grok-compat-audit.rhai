let meta = #{
    name: "lazygrok-grok-compat-audit",
    description: "Parallel audit of lazygrok skills/commands/agents for Grok surface compatibility",
    when_to_use: "When checking whether lazygrok skills and workflows actually run on Grok Build tools",
    phases: [
        #{ title: "Audit", detail: "parallel shard audits of skills, commands, agents" },
        #{ title: "Verify", detail: "adversarial check of high-severity findings" },
        #{ title: "Synthesize", detail: "write ranked compatibility report" },
    ],
};

let shard_schema = #{
    "type": "object",
    "required": ["shard", "items"],
    "properties": #{
        "shard": #{ "type": "string" },
        "items": #{
            "type": "array",
            "maxItems": 40,
            "items": #{
                "type": "object",
                "required": ["name", "kind", "path", "status", "summary"],
                "properties": #{
                    "name": #{ "type": "string" },
                    "kind": #{ "type": "string" },
                    "path": #{ "type": "string" },
                    "status": #{ "type": "string" },
                    "summary": #{ "type": "string" },
                    "blockers": #{
                        "type": "array",
                        "maxItems": 12,
                        "items": #{
                            "type": "object",
                            "required": ["severity", "issue", "evidence", "fix"],
                            "properties": #{
                                "severity": #{ "type": "string" },
                                "issue": #{ "type": "string" },
                                "evidence": #{ "type": "string" },
                                "fix": #{ "type": "string" },
                            },
                        },
                    },
                },
            },
        },
        "notes": #{ "type": "string" },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["real", "reason", "evidence"],
    "properties": #{
        "real": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "evidence": #{ "type": "string" },
    },
};

let report_schema = #{
    "type": "object",
    "required": ["title", "markdown", "counts"],
    "properties": #{
        "title": #{ "type": "string" },
        "markdown": #{ "type": "string" },
        "counts": #{
            "type": "object",
            "required": ["runnable", "needs_adjust", "broken", "unchecked"],
            "properties": #{
                "runnable": #{ "type": "integer" },
                "needs_adjust": #{ "type": "integer" },
                "broken": #{ "type": "integer" },
                "unchecked": #{ "type": "integer" },
            },
        },
    },
};

// --- args ---
let plugin_root = if args == () { () } else { args.plugin_root };
if plugin_root == () {
    pause("verification", "Pass args.plugin_root — absolute path to the lazygrok plugin install (e.g. ~/.grok/installed-plugins/lazygrok-*)");
}

// Static Grok surface facts for auditors (session-verified defaults for Grok Build 0.2.x)
let grok_surface = "";
grok_surface += "GROK BUILD SURFACE (treat as ground truth for this audit):\n";
grok_surface += "NATIVE TOOLS OFTEN AVAILABLE: read_file, write, search_replace, list_dir, grep, run_terminal_command, ";
grok_surface += "todo_write, spawn_subagent, get_command_or_subagent_output, kill_command_or_subagent, web_search, ";
grok_surface += "open_page, open_page_with_find, web_fetch, workflow, enter_plan_mode, exit_plan_mode, ask_user_question, ";
grok_surface += "scheduler_*, image_*, x_*, monitor.\n";
grok_surface += "MCP OFTEN AVAILABLE (lazygrok): hashline, lazygrok-lsp / lsp tools, lazygrok-codegraph, playwright; ";
grok_surface += "tasks is scheduled-reminders NOT ultrawork goals. git_bash MCP may fail to connect.\n";
grok_surface += "HOST GOAL TOOLS: update_goal/create_goal/get_goal are NOT reliably injected when workflows are ON ";
grok_surface += "(default). /goal is a user slash command. Missing update_goal is normal, not a bug.\n";
grok_surface += "NOT GROK NATIVE (Codex/Claude names): Bash, Write, StrReplace, TodoWrite, Task tool, apply_patch, ";
grok_surface += "multi_agent_v2, spawn_agent, fork_context, fork_turns, send_input, close_agent, wait_agent, ";
grok_surface += "browser:control-in-app-browser, computer_use as default, Skill tool.\n";
grok_surface += "GROK EQUIVALENTS: Bash->run_terminal_command; Write->write; StrReplace->search_replace; ";
grok_surface += "TodoWrite->todo_write; Task/spawn_agent->spawn_subagent with subagent_type; ";
grok_surface += "browser->playwright MCP or agent-browser CLI.\n";
grok_surface += "STATUS VOCAB: runnable | needs_adjust | broken | n_a. ";
grok_surface += "runnable=works with Grok tools as written; needs_adjust=docs/tool names wrong but intent works after renames; ";
grok_surface += "broken=requires host feature Grok lacks with no viable substitute; n_a=meta/docs only.\n";

// Shard list: category + relative paths under plugin_root
let shards = [
    #{
        id: "loops-ulw",
        paths: [
            "skills/ultrawork/SKILL.md",
            "skills/ulw-evidence/SKILL.md",
            "skills/ulw-loop/SKILL.md",
            "skills/ulw-plan/SKILL.md",
            "skills/ralph-loop/SKILL.md",
            "skills/cancel-ralph/SKILL.md",
            "commands/ultrawork.md",
            "commands/ulw-loop.md",
            "commands/ralph-loop.md",
        ],
    },
    #{
        id: "planning-start",
        paths: [
            "skills/prometheus-plan/SKILL.md",
            "skills/start-work-execution/SKILL.md",
            "vendor/lazygrok-skills/start-work/SKILL.md",
            "vendor/superpowers/skills/writing-plans/SKILL.md",
            "vendor/superpowers/skills/brainstorming/SKILL.md",
            "vendor/superpowers/skills/executing-plans/SKILL.md",
            "commands/plan.md",
            "commands/start-work.md",
            "commands/resume-continuation.md",
            "commands/stop-continuation.md",
        ],
    },
    #{
        id: "git-vcs",
        paths: [
            "skills/git-master/SKILL.md",
            "skills/git-workflow/SKILL.md",
            "vendor/superpowers/skills/using-git-worktrees/SKILL.md",
            "vendor/superpowers/skills/finishing-a-development-branch/SKILL.md",
        ],
    },
    #{
        id: "implement-tdd",
        paths: [
            "skills/disciplined-implementation/SKILL.md",
            "skills/test-driven/SKILL.md",
            "skills/refactoring/SKILL.md",
            "skills/remove-ai-slops/SKILL.md",
            "skills/programming-references/SKILL.md",
            "vendor/lazygrok-skills/programming/SKILL.md",
            "vendor/lazygrok-skills/refactor/SKILL.md",
            "vendor/superpowers/skills/test-driven-development/SKILL.md",
            "vendor/superpowers/skills/subagent-driven-development/SKILL.md",
        ],
    },
    #{
        id: "review-verify",
        paths: [
            "skills/code-review/SKILL.md",
            "vendor/lazygrok-skills/review-work/SKILL.md",
            "vendor/superpowers/skills/receiving-code-review/SKILL.md",
            "vendor/superpowers/skills/requesting-code-review/SKILL.md",
            "vendor/superpowers/skills/verification-before-completion/SKILL.md",
            "vendor/lazygrok-skills/visual-qa/SKILL.md",
        ],
    },
    #{
        id: "tools-mcp",
        paths: [
            "skills/hashline-edit/SKILL.md",
            "skills/lsp/SKILL.md",
            "vendor/lazygrok-skills/lsp-setup/SKILL.md",
            "vendor/lazygrok-skills/ast-grep/SKILL.md",
            "vendor/lazygrok-skills/comment-checker/SKILL.md",
            "vendor/lazygrok-skills/rules/SKILL.md",
            "skills/agent-skill-gate/SKILL.md",
        ],
    },
    #{
        id: "research-frontend",
        paths: [
            "skills/research/SKILL.md",
            "skills/ultimate-browsing/SKILL.md",
            "vendor/lazygrok-skills/ultraresearch/SKILL.md",
            "vendor/lazygrok-skills/frontend/SKILL.md",
            "vendor/lazygrok-skills/debugging/SKILL.md",
            "skills/systematic-debugging/SKILL.md",
            "vendor/superpowers/skills/systematic-debugging/SKILL.md",
        ],
    },
    #{
        id: "platform-lcx",
        paths: [
            "skills/init-deep/SKILL.md",
            "skills/repo-init/SKILL.md",
            "skills/handoff/SKILL.md",
            "skills/coding-agent-sessions/SKILL.md",
            "vendor/lazygrok-skills/teammode/SKILL.md",
            "vendor/lazygrok-skills/lcx-doctor/SKILL.md",
            "vendor/lazygrok-skills/lcx-report-bug/SKILL.md",
            "vendor/lazygrok-skills/lcx-contribute-bug-fix/SKILL.md",
            "vendor/superpowers/skills/using-superpowers/SKILL.md",
            "vendor/superpowers/skills/dispatching-parallel-agents/SKILL.md",
            "vendor/superpowers/skills/writing-skills/SKILL.md",
            "commands/handoff.md",
        ],
    },
    #{
        id: "agents-frontmatter",
        paths: [
            "agents/atlas.md",
            "agents/explore.md",
            "agents/explorer.md",
            "agents/hephaestus.md",
            "agents/lazygrok-clone-fidelity-reviewer.md",
            "agents/lazygrok-code-reviewer.md",
            "agents/lazygrok-executor.md",
            "agents/lazygrok-gate-reviewer.md",
            "agents/lazygrok-librarian.md",
            "agents/lazygrok-metis.md",
            "agents/lazygrok-momus.md",
            "agents/lazygrok-plan.md",
            "agents/lazygrok-qa-executor.md",
            "agents/librarian.md",
            "agents/metis.md",
            "agents/momus.md",
            "agents/oracle.md",
            "agents/prometheus.md",
            "agents/sisyphus.md",
        ],
    },
];

phase("Audit");
let jobs = [];
for s in shards {
    let paths_blob = "";
    for p in s.paths {
        paths_blob += p;
        paths_blob += "\n";
    }
    let prompt = "";
    prompt += "TASK: Audit lazygrok artifacts for Grok Build compatibility.\n";
    prompt += "You are a cold read-only auditor. Use read_file and grep on ABSOLUTE paths. Do not edit anything.\n";
    prompt += "PLUGIN_ROOT: ";
    prompt += plugin_root;
    prompt += "\nSHARD: ";
    prompt += s.id;
    prompt += "\nRELATIVE PATHS (join each with PLUGIN_ROOT):\n";
    prompt += paths_blob;
    prompt += "\n";
    prompt += grok_surface;
    prompt += "\nPROCEDURE:\n";
    prompt += "1. For each path, read the file (or enough of it to judge tool/API assumptions).\n";
    prompt += "2. Grep the file for foreign tool names: create_goal, update_goal, get_goal, Bash, TodoWrite, ";
    prompt += "Write, StrReplace, apply_patch, multi_agent_v2, spawn_agent, fork_context, Skill tool, ";
    prompt += "browser:control, computer_use, Task tool, Claude Code-only APIs.\n";
    prompt += "3. Also note if it correctly uses Grok names (run_terminal_command, todo_write, spawn_subagent, ";
    prompt += "read_file, search_replace, hashline MCP, codegraph, playwright).\n";
    prompt += "4. Assign status per item. Empty blockers array only if status is runnable or n_a.\n";
    prompt += "5. Evidence must quote file path + short excerpt or line reference from what you read.\n";
    prompt += "6. fix must be concrete (rename tool X->Y, switch to ulw-loop CLI, document fallback, etc.).\n";
    prompt += "Return JSON matching the schema. kind is skill|command|agent. name is basename without extension.\n";
    prompt += "If a path is missing, status=unchecked with a blocker severity=high.\n";

    jobs.push(#{
        prompt: prompt,
        label: "audit:" + s.id,
        capability_mode: "read-only",
        output_schema: shard_schema,
    });
}

let results = parallel(jobs);

let all_items = [];
let shard_ok = 0;
let shard_fail = 0;
for r in results {
    if r != () && r.success && r.output != () && r.output.items != () {
        shard_ok += 1;
        for it in r.output.items {
            all_items.push(it);
        }
    } else {
        shard_fail += 1;
    }
}
log("audit shards ok=" + shard_ok.to_string() + " fail=" + shard_fail.to_string() + " items=" + all_items.len().to_string());

// Collect candidate high/medium blockers for verification (cap 12)
let candidates = [];
for it in all_items {
    if it.blockers == () { continue; }
    for b in it.blockers {
        if b.severity == "high" || b.severity == "medium" {
            if candidates.len() < 12 {
                candidates.push(#{
                    name: it.name,
                    path: it.path,
                    status: it.status,
                    severity: b.severity,
                    issue: b.issue,
                    evidence: b.evidence,
                    fix: b.fix,
                });
            }
        }
    }
}

phase("Verify");
let confirmed = [];
if candidates.len() > 0 {
    let vjobs = [];
    for c in candidates {
        let vp = "";
        vp += "TASK: Adversarially verify this Grok-compat finding. Read the cited file yourself.\n";
        vp += "PLUGIN_ROOT: ";
        vp += plugin_root;
        vp += "\nITEM: ";
        vp += c.name;
        vp += "\nPATH: ";
        vp += c.path;
        vp += "\nCLAIMED STATUS: ";
        vp += c.status;
        vp += "\nSEVERITY: ";
        vp += c.severity;
        vp += "\nISSUE: ";
        vp += c.issue;
        vp += "\nEVIDENCE CLAIM: ";
        vp += c.evidence;
        vp += "\nPROPOSED FIX: ";
        vp += c.fix;
        vp += "\n";
        vp += grok_surface;
        vp += "\nSet real=true ONLY if you independently confirm the file still requires a non-Grok tool ";
        vp += "or host feature with no workable Grok substitute. If the skill already documents a Grok fallback ";
        vp += "or only uses Grok tool names, set real=false. Quote concrete evidence.\n";

        let lab = "verify:" + c.name;
        vjobs.push(#{
            prompt: vp,
            label: lab,
            capability_mode: "read-only",
            output_schema: verdict_schema,
        });
    }
    let verdicts = parallel(vjobs);
    let i = 0;
    for v in verdicts {
        if v != () && v.success && v.output != () && v.output.real == true
            && v.output.evidence != () && v.output.evidence != "" {
            let c = candidates[i];
            confirmed.push(#{
                name: c.name,
                path: c.path,
                severity: c.severity,
                issue: c.issue,
                evidence: v.output.evidence,
                fix: c.fix,
                reason: v.output.reason,
            });
        }
        i += 1;
    }
}
log("verified high/medium blockers kept=" + confirmed.len().to_string() + " of " + candidates.len().to_string());

phase("Synthesize");
let items_json = json_encode(all_items);
let confirmed_json = json_encode(confirmed);
let sp = "";
sp += "TASK: Write a Grok-compatibility report for lazygrok.\n";
sp += "You are synthesizing parallel audit results. Prefer confirmed blockers over unconfirmed ones.\n";
sp += "PLUGIN_ROOT: ";
sp += plugin_root;
sp += "\n\nALL_ITEMS_JSON:\n";
sp += items_json;
sp += "\n\nCONFIRMED_BLOCKERS_JSON (adversarially verified):\n";
sp += confirmed_json;
sp += "\n\n";
sp += grok_surface;
sp += "\nWrite markdown with sections:\n";
sp += "# Lazygrok × Grok compatibility audit\n";
sp += "## Executive summary (counts + top 5 actions)\n";
sp += "## Runnable as-is\n";
sp += "## Needs adjustment (rename/docs/fallback)\n";
sp += "## Broken / host-gap (no Grok substitute)\n";
sp += "## Commands & agents\n";
sp += "## Recommended fix order\n";
sp += "Be concrete. Deduplicate. Do not invent files you cannot see in the JSON. ";
sp += "counts must match the categories you list (approx ok if you reclassify carefully).\n";
sp += "Return title, full markdown string, and counts object.\n";

let syn = agent(sp, #{
    label: "synthesize-report",
    capability_mode: "read-only",
    output_schema: report_schema,
});

if syn == () || !syn.success || syn.output == () || syn.output.markdown == () {
    complete(#{
        summary: "Synthesis failed; returning raw item count only",
        items: all_items.len(),
        confirmed: confirmed.len(),
        shard_ok: shard_ok,
        shard_fail: shard_fail,
    });
}

let report_path = write_scratch_file("lazygrok-grok-compat-report.md", syn.output.markdown);
complete(#{
    summary: syn.output.title,
    path: report_path,
    counts: syn.output.counts,
    items_audited: all_items.len(),
    confirmed_blockers: confirmed.len(),
    shard_ok: shard_ok,
    shard_fail: shard_fail,
});
