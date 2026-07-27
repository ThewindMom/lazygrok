let meta = #{
    name: "ulw-discover",
    description: "ULW hybrid discovery panel — parallel explore (+ optional librarian) with structured findings for the parent ultrawork session",
    when_to_use: "From ultrawork/ulw parent: multi-file or unfamiliar coding before product edits. Parent owns goals, RED/GREEN, commits.",
    phases: [
        #{ title: "Discover", detail: "parallel explore angles (+ librarian when external)" },
        #{ title: "Synthesize", detail: "merge into parent-ready findings" },
    ],
};

// Structured findings per lane
let lane_schema = #{
    "type": "object",
    "required": ["lane", "findings", "ownership", "unknowns"],
    "properties": #{
        "lane": #{ "type": "string" },
        "findings": #{
            "type": "array",
            "maxItems": 20,
            "items": #{
                "type": "object",
                "required": ["path", "fact"],
                "properties": #{
                    "path": #{ "type": "string" },
                    "line": #{ "type": "string" },
                    "fact": #{ "type": "string" },
                },
            },
        },
        "ownership": #{
            "type": "array",
            "maxItems": 12,
            "items": #{
                "type": "object",
                "required": ["area", "paths"],
                "properties": #{
                    "area": #{ "type": "string" },
                    "paths": #{ "type": "string" },
                },
            },
        },
        "unknowns": #{
            "type": "array",
            "maxItems": 12,
            "items": #{ "type": "string" },
        },
        "suggested_slices": #{
            "type": "array",
            "maxItems": 8,
            "items": #{
                "type": "object",
                "required": ["name", "scope", "difficulty"],
                "properties": #{
                    "name": #{ "type": "string" },
                    "scope": #{ "type": "string" },
                    "difficulty": #{ "type": "string" },
                },
            },
        },
        "notes": #{ "type": "string" },
    },
};

let synth_schema = #{
    "type": "object",
    "required": ["summary", "file_line_facts", "ownership_map", "unknowns", "implementation_slices", "ready_to_plan"],
    "properties": #{
        "summary": #{ "type": "string" },
        "file_line_facts": #{
            "type": "array",
            "maxItems": 30,
            "items": #{
                "type": "object",
                "required": ["path", "fact"],
                "properties": #{
                    "path": #{ "type": "string" },
                    "line": #{ "type": "string" },
                    "fact": #{ "type": "string" },
                },
            },
        },
        "ownership_map": #{
            "type": "array",
            "maxItems": 16,
            "items": #{
                "type": "object",
                "required": ["area", "paths"],
                "properties": #{
                    "area": #{ "type": "string" },
                    "paths": #{ "type": "string" },
                },
            },
        },
        "unknowns": #{
            "type": "array",
            "maxItems": 16,
            "items": #{ "type": "string" },
        },
        "implementation_slices": #{
            "type": "array",
            "maxItems": 10,
            "items": #{
                "type": "object",
                "required": ["name", "scope", "difficulty", "depends_on"],
                "properties": #{
                    "name": #{ "type": "string" },
                    "scope": #{ "type": "string" },
                    "difficulty": #{ "type": "string" },
                    "depends_on": #{ "type": "string" },
                },
            },
        },
        "ready_to_plan": #{ "type": "boolean" },
        "external_notes": #{ "type": "string" },
    },
};

// --- args (parent-owned brief; this script never claims "done") ---
let brief = if args == () { () } else { args.brief };
if brief == () || brief == "" {
    pause("verification", "Pass args.brief — the ultrawork objective (user request with ulw/ultrawork stripped).");
}

let scope = if args == () || args.scope == () { "" } else { args.scope };
let need_external = false;
if args != () && args.need_external != () {
    if args.need_external == true || args.need_external == "true" || args.need_external == "1" {
        need_external = true;
    }
}
let workspace = if args == () || args.workspace == () { "" } else { args.workspace };
let extra_angles = if args == () || args.angles == () { () } else { args.angles };

// Default explore lanes (deterministic)
let angles = [
    #{
        id: "structure",
        focus: "module ownership, entry points, layout of the change surface",
    },
    #{
        id: "symbols",
        focus: "symbols, callers, tests, and blast radius for the brief keywords",
    },
    #{
        id: "constraints",
        focus: "existing patterns, invariants, config, and adjacent surfaces that must not break",
    },
];

// Optional extra angles from args.angles as string array
if extra_angles != () {
    // Rhai: treat as array of strings when parent passes them
    let idx = 0;
    for a in extra_angles {
        if idx < 3 {
            let aid = "extra-" + idx.to_string();
            angles.push(#{ id: aid, focus: a });
        }
        idx += 1;
    }
}

fn build_explore_prompt(brief_text, scope_text, workspace_text, lane_id, focus_text) {
    let p = "";
    p += "TASK: Read-only discovery for an ultrawork parent. Do NOT edit files. Do NOT implement.\n";
    p += "DELIVERABLE: Structured findings with file:line facts, ownership, unknowns, optional implementation slices.\n";
    p += "SCOPE: ";
    if scope_text != "" {
        p += scope_text;
    } else {
        p += "whole workspace as needed; prefer tight paths once found";
    }
    p += "\nVERIFY: Every fact cites a path you actually read (path + line or short excerpt).\n";
    p += "STOP WHEN: You have enough ownership + facts for the parent to plan or implement without re-exploring this lane.\n\n";
    p += "BRIEF: ";
    p += brief_text;
    p += "\nLANE: ";
    p += lane_id;
    p += "\nFOCUS: ";
    p += focus_text;
    p += "\n";
    if workspace_text != "" {
        p += "WORKSPACE: ";
        p += workspace_text;
        p += "\n";
    }
    p += "\nTOOLS: Prefer codegraph_explore if available; else grep + read_file + list_dir. ";
    p += "Use lsp_* for definitions/references when present. Shell only for read-only git/rg if needed.\n";
    p += "Empty findings only after you searched; never invent paths.\n";
    p += "difficulty for slices: low|medium|high.\n";
    p
}

phase("Discover");
let jobs = [];
for ang in angles {
    let prompt = build_explore_prompt(brief, scope, workspace, ang.id, ang.focus);
    jobs.push(#{
        prompt: prompt,
        label: "explore:" + ang.id,
        capability_mode: "read-only",
        agent_type: "lazygrok:explore",
        output_schema: lane_schema,
    });
}

if need_external {
    let lp = "";
    lp += "TASK: External/docs/API research for an ultrawork parent. Do NOT edit the product repo.\n";
    lp += "DELIVERABLE: Version-pinned library/API facts, official doc URLs, and constraints the parent must obey.\n";
    lp += "SCOPE: Only what the brief requires outside the repo (docs, packages, APIs).\n";
    lp += "VERIFY: Cite exact URLs/paths/versions; separate facts from assumptions.\n";
    lp += "STOP WHEN: Parent can implement without guessing external contracts.\n\n";
    lp += "BRIEF: ";
    lp += brief;
    lp += "\n";
    if scope != "" {
        lp += "SCOPE HINT: ";
        lp += scope;
        lp += "\n";
    }
    lp += "Return as lane=librarian with findings (path may be a URL), ownership empty if N/A, unknowns listed, notes for versions.\n";
    jobs.push(#{
        prompt: lp,
        label: "librarian:external",
        capability_mode: "read-only",
        agent_type: "lazygrok:librarian",
        output_schema: lane_schema,
    });
}

let results = parallel(jobs);

let lanes = [];
let lane_ok = 0;
let lane_fail = 0;
for r in results {
    if r != () && r.success && r.output != () {
        lane_ok += 1;
        lanes.push(r.output);
    } else {
        lane_fail += 1;
    }
}
log("discover lanes ok=" + lane_ok.to_string() + " fail=" + lane_fail.to_string());

if lane_ok == 0 {
    complete(#{
        summary: "Discovery failed — all lanes empty or unsuccessful",
        panel: "discover",
        parent_action: "retry with spawn_subagent explore or narrow args.scope",
        lane_ok: 0,
        lane_fail: lane_fail,
        ready_to_implement: false,
    });
}

phase("Synthesize");
let lanes_json = json_encode(lanes);
let sp = "";
sp += "TASK: Merge parallel discovery lanes into one parent-ready discovery packet for ultrawork.\n";
sp += "You are NOT implementing. Deduplicate facts. Prefer file:line over vague prose.\n";
sp += "BRIEF: ";
sp += brief;
sp += "\n\nLANES_JSON:\n";
sp += lanes_json;
sp += "\n\nRules:\n";
sp += "- file_line_facts: max signal, cite path (+ line when known).\n";
sp += "- ownership_map: areas the parent can assign to workers.\n";
sp += "- unknowns: only remaining open questions that block correct design.\n";
sp += "- implementation_slices: independent units with difficulty low|medium|high and depends_on (or empty string).\n";
sp += "- ready_to_plan=true only if ownership is clear enough to plan without another discovery wave.\n";
sp += "- external_notes: librarian version/URL facts if any; else empty string.\n";
sp += "Do not claim the product work is done.\n";

let syn = agent(sp, #{
    label: "discover-synthesize",
    capability_mode: "read-only",
    output_schema: synth_schema,
});

if syn == () || !syn.success || syn.output == () {
    // Fail-open with raw lanes so parent can still act
    let raw_path = write_scratch_file("ulw-discover-raw.json", lanes_json);
    complete(#{
        summary: "Synthesis failed; raw lanes saved",
        panel: "discover",
        path: raw_path,
        lane_ok: lane_ok,
        lane_fail: lane_fail,
        lanes: lanes,
        ready_to_implement: false,
        parent_action: "integrate raw lanes into notepad; do not treat as approval",
    });
}

// Guard optional arrays — dry-run/canned hosts may omit schema fields
let facts = [];
if syn.output.file_line_facts != () && type_of(syn.output.file_line_facts) == "array" {
    facts = syn.output.file_line_facts;
}
let ownership = [];
if syn.output.ownership_map != () && type_of(syn.output.ownership_map) == "array" {
    ownership = syn.output.ownership_map;
}
let unknowns = [];
if syn.output.unknowns != () && type_of(syn.output.unknowns) == "array" {
    unknowns = syn.output.unknowns;
}
let slices = [];
if syn.output.implementation_slices != () && type_of(syn.output.implementation_slices) == "array" {
    slices = syn.output.implementation_slices;
}
let summary_text = "";
if syn.output.summary != () {
    summary_text = syn.output.summary;
} else {
    summary_text = "Discovery synthesis complete";
}
let ready_plan = false;
if syn.output.ready_to_plan == true {
    ready_plan = true;
}
let external_notes = "";
if syn.output.external_notes != () {
    external_notes = syn.output.external_notes;
}

let md = "";
md += "# ULW discovery packet\n\n";
md += "## Summary\n";
md += summary_text;
md += "\n\n## File:line facts\n";
if facts.len() == 0 {
    md += "_No structured facts (see lanes JSON / parent re-check)._\n";
} else {
    for f in facts {
        md += "- `";
        if f.path != () { md += f.path; } else { md += "?"; }
        if f.line != () && f.line != "" {
            md += ":";
            md += f.line;
        }
        md += "` — ";
        if f.fact != () { md += f.fact; }
        md += "\n";
    }
}
md += "\n## Ownership\n";
if ownership.len() == 0 {
    md += "_None listed._\n";
} else {
    for o in ownership {
        md += "- **";
        if o.area != () { md += o.area; }
        md += "**: ";
        if o.paths != () { md += o.paths; }
        md += "\n";
    }
}
md += "\n## Unknowns\n";
if unknowns.len() == 0 {
    md += "_None listed._\n";
} else {
    for u in unknowns {
        md += "- ";
        md += u;
        md += "\n";
    }
}
md += "\n## Implementation slices\n";
if slices.len() == 0 {
    md += "_None listed — parent may plan directly._\n";
} else {
    for s in slices {
        md += "- **";
        if s.name != () { md += s.name; }
        md += "** (";
        if s.difficulty != () { md += s.difficulty; }
        md += "): ";
        if s.scope != () { md += s.scope; }
        if s.depends_on != () && s.depends_on != "" {
            md += " — depends_on: ";
            md += s.depends_on;
        }
        md += "\n";
    }
}
if external_notes != "" {
    md += "\n## External notes\n";
    md += external_notes;
    md += "\n";
}
md += "\n## Parent actions (binding)\n";
md += "- Append this packet to the ultrawork notepad `## Findings`.\n";
md += "- Parent still owns: goal ledger, RED→GREEN, SURFACE QA, cleanup, commits, done claim.\n";
md += "- This panel never marks product work complete.\n";

let report_path = write_scratch_file("ulw-discover-report.md", md);
complete(#{
    summary: summary_text,
    panel: "discover",
    path: report_path,
    ready_to_plan: ready_plan,
    ready_to_implement: false,
    file_line_facts: facts,
    ownership_map: ownership,
    unknowns: unknowns,
    implementation_slices: slices,
    external_notes: external_notes,
    lane_ok: lane_ok,
    lane_fail: lane_fail,
    parent_action: "integrate into notepad; plan or implement; never skip RED/GREEN",
});
