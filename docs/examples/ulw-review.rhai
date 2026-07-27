let meta = #{
    name: "ulw-review",
    description: "ULW hybrid review panel — parallel dimension review + adversarial verify for HEAVY ultrawork; parent owns fix loop and done claim",
    when_to_use: "From ultrawork/ulw parent after evidence is captured (HEAVY or user demanded rigorous review). Parent prepares diff_path first.",
    phases: [
        #{ title: "Review", detail: "parallel review dimensions against the prepared diff" },
        #{ title: "Verify", detail: "adversarial skeptics on high/medium findings" },
        #{ title: "Verdict", detail: "parent-ready blockers vs notes" },
    ],
};

let findings_schema = #{
    "type": "object",
    "required": ["dimension", "findings"],
    "properties": #{
        "dimension": #{ "type": "string" },
        "findings": #{
            "type": "array",
            "maxItems": 10,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "severity", "criterion_link"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                    "criterion_link": #{ "type": "string" },
                    "evidence": #{ "type": "string" },
                },
            },
        },
        "notes": #{ "type": "string" },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["real", "blocks_criterion", "reason", "evidence"],
    "properties": #{
        "real": #{ "type": "boolean" },
        "blocks_criterion": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "evidence": #{ "type": "string" },
    },
};

let final_schema = #{
    "type": "object",
    "required": ["approved", "blockers", "notes", "summary"],
    "properties": #{
        "approved": #{ "type": "boolean" },
        "summary": #{ "type": "string" },
        "blockers": #{
            "type": "array",
            "maxItems": 16,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "criterion_link", "evidence"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "criterion_link": #{ "type": "string" },
                    "evidence": #{ "type": "string" },
                },
            },
        },
        "notes": #{
            "type": "array",
            "maxItems": 16,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "reason"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "reason": #{ "type": "string" },
                },
            },
        },
    },
};

// --- args ---
let goal = if args == () { () } else { args.goal };
let criteria = if args == () { () } else { args.criteria };
let diff_path = if args == () { () } else { args.diff_path };

if goal == () || goal == "" {
    pause("verification", "Pass args.goal — ultrawork objective.");
}
if criteria == () || criteria == "" {
    pause("verification", "Pass args.criteria — success criteria text (or path contents inlined by parent).");
}
if diff_path == () || diff_path == "" {
    pause("verification", "Pass args.diff_path — absolute path to full base...HEAD diff the parent prepared.");
}

let stat_path = if args == () || args.stat_path == () { "" } else { args.stat_path };
let changed_files = if args == () || args.changed_files == () { "" } else { args.changed_files };
let evidence_paths = if args == () || args.evidence_paths == () { "" } else { args.evidence_paths };
let notepad_path = if args == () || args.notepad_path == () { "" } else { args.notepad_path };
let plugin_root = if args == () || args.plugin_root == () { "" } else { args.plugin_root };
let report_hint = if args == () || args.report_path == () { ".lazygrok/evidence/ulw-review.md" } else { args.report_path };

let skill_slop = "";
let skill_prog = "";
if plugin_root != "" {
    skill_slop = plugin_root + "/skills/remove-ai-slops/SKILL.md";
    skill_prog = plugin_root + "/vendor/lazygrok-skills/programming/SKILL.md";
}

let dimensions = [
    "correctness bugs vs stated success criteria",
    "missing error handling and edge cases named by criteria",
    "regressions on adjacent surfaces and incomplete evidence",
];

fn build_review_prompt(goal_text, criteria_text, diff_path_text, stat_path_text, changed_text, evidence_text, notepad_text, skill_a, skill_b, dim) {
    let p = "";
    p += "TASK: Review a prepared ultrawork diff for one dimension. Read the diff file and cited paths. Do NOT edit product code.\n";
    p += "DELIVERABLE: Up to 10 findings {file, issue, severity, criterion_link, evidence}.\n";
    p += "SCOPE: Only this dimension — ";
    p += dim;
    p += "\nVERIFY: Every finding must quote evidence from the diff or source you read. severity is high|medium|low.\n";
    p += "STOP WHEN: You finished this dimension or have 10 findings.\n\n";
    p += "GOAL: ";
    p += goal_text;
    p += "\n\nSUCCESS CRITERIA:\n";
    p += criteria_text;
    p += "\n\nDIFF_PATH (read with read_file / run_terminal_command): ";
    p += diff_path_text;
    p += "\n";
    if stat_path_text != "" {
        p += "STAT_PATH: ";
        p += stat_path_text;
        p += "\n";
    }
    if changed_text != "" {
        p += "CHANGED_FILES:\n";
        p += changed_text;
        p += "\n";
    }
    if evidence_text != "" {
        p += "EVIDENCE_PATHS (QA artifacts parent captured):\n";
        p += evidence_text;
        p += "\n";
    }
    if notepad_text != "" {
        p += "NOTEPAD: ";
        p += notepad_text;
        p += "\n";
    }
    if skill_a != "" {
        p += "Optional skill perspectives (read if present): ";
        p += skill_a;
        p += " and ";
        p += skill_b;
        p += "\n";
    }
    p += "\ncriterion_link: name the success criterion this finding threatens, or \"none\" if only a note.\n";
    p += "Empty findings array is valid only after reading the diff.\n";
    p
}

phase("Review");
let jobs = [];
for d in dimensions {
    let prompt = build_review_prompt(goal, criteria, diff_path, stat_path, changed_files, evidence_paths, notepad_path, skill_slop, skill_prog, d);
    jobs.push(#{
        prompt: prompt,
        label: "review-dim",
        capability_mode: "read-only",
        agent_type: "lazygrok:lazygrok-code-reviewer",
        output_schema: findings_schema,
    });
}

let results = parallel(jobs);

let all_findings = [];
let dim_ok = 0;
let dim_fail = 0;
for r in results {
    if r != () && r.success && r.output != () && r.output.findings != ()
        && type_of(r.output.findings) == "array" {
        dim_ok += 1;
        for f in r.output.findings {
            let ev = "";
            if f.evidence != () { ev = f.evidence; }
            let dim_name = "";
            if r.output.dimension != () { dim_name = r.output.dimension; }
            all_findings.push(#{
                file: f.file,
                issue: f.issue,
                severity: f.severity,
                criterion_link: f.criterion_link,
                evidence: ev,
                dimension: dim_name,
            });
        }
    } else {
        dim_fail += 1;
    }
}
log("review dims ok=" + dim_ok.to_string() + " fail=" + dim_fail.to_string() + " findings=" + all_findings.len().to_string());

// Cap candidates for verify
let candidates = [];
for f in all_findings {
    if f.severity == "high" || f.severity == "medium" {
        if candidates.len() < 12 {
            candidates.push(f);
        }
    }
}

phase("Verify");
let confirmed = [];
let demoted = [];
if candidates.len() > 0 {
    let vjobs = [];
    for c in candidates {
        let vp = "";
        vp += "TASK: Adversarially verify this review finding against the real diff and code. Prefer to refute weak claims.\n";
        vp += "Set real=true only with independent evidence you inspected. blocks_criterion=true only if a named success criterion fails.\n";
        vp += "Do NOT edit code.\n\n";
        vp += "GOAL: ";
        vp += goal;
        vp += "\nCRITERIA:\n";
        vp += criteria;
        vp += "\nDIFF_PATH: ";
        vp += diff_path;
        vp += "\nFILE: ";
        vp += c.file;
        vp += "\nISSUE: ";
        vp += c.issue;
        vp += "\nSEVERITY: ";
        vp += c.severity;
        vp += "\nCRITERION_LINK: ";
        vp += c.criterion_link;
        vp += "\nCLAIMED_EVIDENCE: ";
        vp += c.evidence;
        vp += "\n";
        vjobs.push(#{
            prompt: vp,
            label: "verify-finding",
            capability_mode: "read-only",
            output_schema: verdict_schema,
        });
    }
    let verdicts = parallel(vjobs);
    let i = 0;
    for v in verdicts {
        let c = candidates[i];
        if v != () && v.success && v.output != () && v.output.real == true
            && v.output.evidence != () && v.output.evidence != "" {
            if v.output.blocks_criterion == true && c.criterion_link != "none" && c.criterion_link != "" {
                confirmed.push(#{
                    file: c.file,
                    issue: c.issue,
                    criterion_link: c.criterion_link,
                    evidence: v.output.evidence,
                });
            } else {
                demoted.push(#{
                    file: c.file,
                    issue: c.issue,
                    reason: v.output.reason,
                });
            }
        }
        i += 1;
    }
}
log("blockers=" + confirmed.len().to_string() + " notes=" + demoted.len().to_string());

phase("Verdict");
// Deterministic parent-ready verdict without extra agent when synthesis is simple
let approved = confirmed.len() == 0;
let summary = "";
if approved {
    summary = "No criterion-blocking findings after adversarial verify.";
} else {
    summary = confirmed.len().to_string() + " criterion-blocking findings require parent fix + re-evidence.";
}

// Low findings (not verified) become notes
for f in all_findings {
    if f.severity == "low" {
        if demoted.len() < 16 {
            demoted.push(#{
                file: f.file,
                issue: f.issue,
                reason: "low severity — parent judgment",
            });
        }
    }
}

let md = "";
md += "# ULW review panel verdict\n\n";
md += "## Summary\n";
md += summary;
md += "\n\n**approved (no criterion blockers):** ";
if approved {
    md += "true";
} else {
    md += "false";
}
md += "\n\n## Goal\n";
md += goal;
md += "\n\n## Blockers (parent MUST fix before claiming done)\n";
if confirmed.len() == 0 {
    md += "_None._\n";
} else {
    for b in confirmed {
        md += "- `";
        md += b.file;
        md += "`: ";
        md += b.issue;
        md += " (criterion: ";
        md += b.criterion_link;
        md += ") — ";
        md += b.evidence;
        md += "\n";
    }
}
md += "\n## Notes (non-blocking)\n";
if demoted.len() == 0 {
    md += "_None._\n";
} else {
    for n in demoted {
        md += "- `";
        md += n.file;
        md += "`: ";
        md += n.issue;
        md += " — ";
        md += n.reason;
        md += "\n";
    }
}
md += "\n## Parent actions (binding)\n";
md += "- Fix only criterion-linked blockers; re-run affected SURFACE QA; capture fresh evidence.\n";
md += "- Re-submit this panel at most twice with delta diff (ultrawork verification gate).\n";
md += "- This panel does NOT commit, does NOT claim done, does NOT update the goal ledger.\n";
md += "- Suggested report path: ";
md += report_hint;
md += "\n";
md += "- dim_ok=";
md += dim_ok.to_string();
md += " dim_fail=";
md += dim_fail.to_string();
md += "\n";

let report_path = write_scratch_file("ulw-review-report.md", md);
let parent_action = "fix blockers; re-evidence; re-run ulw-review with delta diff (max 2 re-submits)";
if approved {
    parent_action = "record review approval in notepad; finish remaining SURFACE/cleanup; claim done only if criteria pass";
}
complete(#{
    summary: summary,
    panel: "review",
    path: report_path,
    approved: approved,
    blockers: confirmed,
    notes: demoted,
    dim_ok: dim_ok,
    dim_fail: dim_fail,
    parent_action: parent_action,
});
