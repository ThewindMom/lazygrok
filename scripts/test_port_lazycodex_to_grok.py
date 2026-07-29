import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("port-lazycodex-to-grok.py")
SPEC = importlib.util.spec_from_file_location("port_lazycodex_to_grok", SCRIPT)
assert SPEC is not None
assert SPEC.loader is not None
PORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PORT)
REPO_ROOT = SCRIPT.parent.parent


class ReviewWorkTransformTest(unittest.TestCase):
    def test_injects_isolation_gate_once(self) -> None:
        source = """---
name: review-work
---
# Review Work - 5-Agent Parallel Review Orchestrator
"""

        transformed = PORT.transform_text(source)

        self.assertEqual(
            transformed.count("## Phase -1: Mandatory branch-review isolation gate"),
            1,
        )
        self.assertEqual(PORT.transform_text(transformed), transformed)

    def test_fails_when_upstream_heading_drifts(self) -> None:
        source = """---
name: review-work
---
# Renamed Review Work
"""

        with self.assertRaisesRegex(ValueError, "insertion heading is missing"):
            PORT.transform_text(source)

    def test_rewrites_legacy_worktree_command(self) -> None:
        source = """---
name: review-work
---
Review PRs and branches from a dedicated review worktree only: create or attach one with `git worktree add <path> <branch>` before collecting changed files, diff, file contents, or running checks. The main worktree is read-only context; never checkout, test, or edit the review branch there.
# Review Work - 5-Agent Parallel Review Orchestrator
"""

        transformed = PORT.transform_text(source)

        self.assertNotIn("git worktree add <path> <branch>", transformed)
        self.assertIn("mandatory Phase -1 isolation gate", transformed)


class RefactorTransformTest(unittest.TestCase):
    def test_removes_codex_team_transport_addendum(self) -> None:
        source = """---
name: refactor
description: test
---

## Codex Harness Tool Compatibility

Translate team tools.

export const REFACTOR_TEMPLATE = `# Intelligent Refactor Command

Use the ordinary worker flow.

<user-request>
$ARGUMENTS
</user-request>
`

export const REFACTOR_TEAM_MODE_ADDENDUM = `
# Team Mode Protocol

Call `team_create`, `team_task_create`, and `team_status`.
`
"""

        transformed = PORT.transform_text(source)

        self.assertIn("# Intelligent Refactor Command", transformed)
        self.assertIn("Use the ordinary worker flow.", transformed)
        self.assertNotIn("REFACTOR_TEMPLATE", transformed)
        self.assertNotIn("REFACTOR_TEAM_MODE_ADDENDUM", transformed)
        self.assertNotIn("team_create", transformed)
        self.assertNotIn("team_task_create", transformed)
        self.assertNotIn("team_status", transformed)
        self.assertEqual(PORT.transform_text(transformed), transformed)


class DebuggingTransformTest(unittest.TestCase):
    def test_removes_durable_team_investigation_path(self) -> None:
        source = """# Phase 2 + 3 — Hypothesis Formation & Parallel Investigation

### Path A: Team mode ENABLED

Call `team_task_create`, `team_send_message`, and `team_delete`.

### Path B: Team mode DISABLED

Fan out async explore/deep subagents instead.
"""

        transformed = PORT.transform_text(source)

        self.assertIn("### Grok parallel investigation", transformed)
        self.assertIn("spawn_subagent", transformed)
        self.assertNotIn("team_task_create", transformed)
        self.assertNotIn("team_send_message", transformed)
        self.assertNotIn("team_delete", transformed)
        self.assertEqual(PORT.transform_text(transformed), transformed)


class GrokTeamRoutingTest(unittest.TestCase):
    def test_normalizes_executable_subagent_examples(self) -> None:
        source = """
call_omo_agent(subagent_type="explore", run_in_background=True)
Task(subagent_type="librarian")
task(category="deep", load_skills=["debugging"])
spawn_subagent({"message":"review", "agent_type":"explore"})
background_output(task_id="worker-1")
"""

        transformed = PORT.transform_text(source)

        self.assertEqual(transformed.count("spawn_subagent("), 4)
        self.assertIn("get_command_or_subagent_output(", transformed)
        self.assertIn("background=True", transformed)
        for unsupported in ("call_omo_agent(", "Task(", "task(", "background_output("):
            self.assertNotIn(unsupported, transformed)
        for unsupported_field in ("load_skills=", "category=", '"agent_type":'):
            self.assertNotIn(unsupported_field, transformed)

    def test_replaces_upstream_teammode_with_grok_fan_out(self) -> None:
        source = """---
name: teammode
---
Call `codex_app.create_thread`, `team_mode`, and `multi_agent_v2`.
"""

        transformed = PORT.transform_text(source)

        self.assertEqual(transformed, PORT.GROK_TEAMMODE_SKILL)
        self.assertIn("spawn_subagent", transformed)
        self.assertIsNone(PORT.UNSUPPORTED_GROK_TOOL_ROUTE.search(transformed))
        self.assertEqual(PORT.transform_text(transformed), transformed)

    def test_replaces_research_team_transport_section(self) -> None:
        source = """---
name: ulw-research
---
## Run the swarm as a cooperating team

Use `codex_app.create_thread` with `team_mode`.

## Worker ground rules

Keep this section.
"""

        transformed = PORT.transform_text(source)

        self.assertIn("## Run the swarm with parallel Grok subagents", transformed)
        self.assertIn("spawn_subagent", transformed)
        self.assertIn("## Worker ground rules", transformed)
        self.assertIsNone(PORT.UNSUPPORTED_GROK_TOOL_ROUTE.search(transformed))
        self.assertEqual(PORT.transform_text(transformed), transformed)

    def test_removes_unsupported_hook_routes_and_detects_regressions(self) -> None:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            skills = root / "skills" / "teammode"
            skills.mkdir(parents=True)
            (skills / "SKILL.md").write_text(
                PORT.GROK_TEAMMODE_SKILL, encoding="utf-8"
            )
            (root / "plugin.json").write_text(
                json.dumps(
                    {
                        "skills": [
                            "./skills",
                            "./vendor/lazygrok-skills",
                            "./vendor/lazygrok-hooks",
                        ]
                    }
                ),
                encoding="utf-8",
            )
            hooks = root / "hooks" / "hooks.json"
            hooks.parent.mkdir()
            hooks.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "PostToolUse": [
                                {
                                    "matcher": "create_thread",
                                    "hooks": [
                                        {
                                            "command": (
                                                "node shim.mjs teammode post-tool-use"
                                            )
                                        }
                                    ],
                                },
                                {
                                    "matcher": "write",
                                    "hooks": [{"command": "node shim.mjs rules"}],
                                },
                                {
                                    "hooks": [
                                        {
                                            "command": (
                                                "node shim.mjs telemetry session-start"
                                            )
                                        }
                                    ],
                                },
                            ]
                        }
                    }
                ),
                encoding="utf-8",
            )

            self.assertEqual(PORT.remove_unsupported_hook_routes(hooks), 2)
            self.assertEqual(PORT.find_unsupported_active_tool_routes(root), [])

            (skills / "SKILL.md").write_text(
                "Use `codex_app.create_thread`.\n", encoding="utf-8"
            )
            offenders = PORT.find_unsupported_active_tool_routes(root)
            self.assertEqual(len(offenders), 1)
            self.assertIn("codex_app.create_thread", offenders[0])

            (skills / "SKILL.md").write_text(
                PORT.GROK_TEAMMODE_SKILL, encoding="utf-8"
            )
            scripts = root / "vendor/lazygrok-skills/teammode/scripts"
            scripts.mkdir(parents=True)
            (scripts / "team-transport.mjs").write_text(
                'export const transport = "codex_app.create_thread";\n',
                encoding="utf-8",
            )
            component = root / "vendor/lazygrok-hooks/teammode"
            component.mkdir(parents=True)
            (component / "hooks.json").write_text(
                '{"matcher":"create_thread"}\n', encoding="utf-8"
            )
            offenders = PORT.find_unsupported_active_tool_routes(root)
            self.assertEqual(len(offenders), 2)

            telemetry = root / "vendor/lazygrok-hooks/telemetry"
            telemetry.mkdir(parents=True)
            (telemetry / "hooks.json").write_text(
                '{"command":"node shim.mjs telemetry session-start"}\n',
                encoding="utf-8",
            )

            removed = PORT.prune_unsupported_runtime(root)
            self.assertEqual(
                removed,
                [
                    "vendor/lazygrok-hooks/teammode",
                    "vendor/lazygrok-hooks/telemetry",
                    "vendor/lazygrok-skills/teammode/scripts",
                ],
            )
            self.assertEqual(PORT.find_unsupported_active_tool_routes(root), [])


class StartWorkRoutingTest(unittest.TestCase):
    def test_routes_start_work_to_the_single_top_level_catalog_entry(self) -> None:
        vendor = Path("/plugin/vendor/lazygrok-skills")
        top = Path("/plugin/skills")

        self.assertEqual(
            PORT.skill_destination("start-work", vendor, top),
            top / "start-work-execution",
        )
        self.assertEqual(
            PORT.skill_destination("ulw-loop", vendor, top),
            vendor / "ulw-loop",
        )

    def test_rewrites_start_work_state_to_grok_canonical_paths(self) -> None:
        transformed = PORT.transform_text(
            "Read `.omo/boulder.json`, append `.omo/start-work/ledger.jsonl`, "
            "and write `codex:<session_id>`."
        )

        self.assertEqual(
            transformed,
            "Read `.lazygrok/boulder.json`, append "
            "`.lazygrok/start-work/ledger.jsonl`, and write "
            "`grok:<session_id>`.",
        )

    def test_rewrites_unquoted_start_work_session_prefix(self) -> None:
        self.assertEqual(
            PORT.transform_text("Continue with codex:<session_id>."),
            "Continue with grok:<session_id>.",
        )

    def test_identifies_grok_canonical_skill_trees(self) -> None:
        top = Path("/plugin/skills")
        self.assertEqual(
            PORT.canonical_skill_path("start-work", top),
            top / "start-work-execution",
        )
        self.assertEqual(
            PORT.canonical_skill_path("ulw-loop", top),
            top / "ulw-loop",
        )
        self.assertIsNone(PORT.canonical_skill_path("debugging", top))


class GeneratedCopyParityTest(unittest.TestCase):
    def test_ultrawork_normalization_preserves_worktree_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            skill = Path(root) / "SKILL.md"
            skill.write_text(
                "---\n"
                "name: ultrawork\n"
                "---\n\n"
                "Spawn prompts use the required shape.\n\n"
                "# CODING MULTI-AGENT\n",
                encoding="utf-8",
            )

            PORT.normalize_ultrawork_skill(skill)

            normalized = skill.read_text(encoding="utf-8")
            self.assertIn("# Worktree boundary", normalized)
            self.assertIn("grok --cwd <absolute-path>", normalized)
            self.assertIn("git worktree list --porcelain", normalized)
            self.assertIn("source checkout stayed\n  unchanged", normalized)

    def test_registered_ultrawork_copies_are_identical(self) -> None:
        paths = [
            REPO_ROOT / "skills/ultrawork/SKILL.md",
            REPO_ROOT / "vendor/lazygrok-skills/ultrawork/SKILL.md",
            REPO_ROOT
            / "vendor/lazygrok-hooks/ultrawork/skills/ultrawork/SKILL.md",
        ]

        contents = [path.read_bytes() for path in paths]
        self.assertEqual(contents, [contents[0]] * len(contents))
        self.assertIn(b"# Worktree boundary", contents[0])

    def test_synchronizes_generated_skill_trees_byte_for_byte(self) -> None:
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            canonical = base / "skills/ulw-loop"
            first = base / "vendor/skills/ulw-loop"
            second = base / "vendor/hooks/ulw-loop/skills/ulw-loop"
            canonical.mkdir(parents=True)
            first.mkdir(parents=True)
            (canonical / "SKILL.md").write_text("canonical\n", encoding="utf-8")
            (canonical / "references").mkdir()
            (canonical / "references/full-workflow.md").write_text(
                "workflow\n", encoding="utf-8"
            )
            (first / "SKILL.md").write_text("stale\n", encoding="utf-8")

            changed = PORT.synchronize_tree_copies(canonical, [first, second])

            self.assertEqual(changed, 2)
            self.assertEqual(
                (first / "SKILL.md").read_bytes(),
                (canonical / "SKILL.md").read_bytes(),
            )
            self.assertEqual(
                (second / "references/full-workflow.md").read_bytes(),
                (canonical / "references/full-workflow.md").read_bytes(),
            )

    def test_rewrites_visual_and_planner_paths_without_fake_grok_tools(self) -> None:
        transformed = PORT.transform_text(
            "Directly open the screenshots with the available image-viewing tool "
            "(`view_image`, `look_at`, or browser inspection) before judging. "
            "Write `.omo/drafts/example.md`."
        )

        self.assertNotIn("`view_image`", transformed)
        self.assertNotIn("`look_at`", transformed)
        self.assertIn("Playwright/browser", transformed)
        self.assertIn("`.lazygrok/drafts/example.md`", transformed)

    def test_maps_upstream_product_repositories_to_grok_owners(self) -> None:
        transformed = PORT.transform_text(
            "code-yeongyu/lazycodex openai/codex "
            "LAZYCODEX_SOURCE_ROOT openai-codex-source"
        )

        self.assertEqual(
            transformed,
            "ThewindMom/lazygrok xai-org/grok-build "
            "LAZYGROK_SOURCE_ROOT grok-build-source",
        )


class ActiveDocumentationTest(unittest.TestCase):
    def test_active_skills_use_only_grok_subagent_callables(self) -> None:
        unsupported = re.compile(
            r"(?:\bcall_omo_agent|\bbackground_output)\s*\("
            r"|\b(?:Task|task)\s*\("
            r"(?=\s*(?:subagent_type|category|description|prompt|load_skills)\s*=)"
        )
        skills = REPO_ROOT / "vendor/lazygrok-skills"

        for path in skills.rglob("*.md"):
            with self.subTest(path=path.relative_to(REPO_ROOT)):
                text = path.read_text(encoding="utf-8")
                self.assertIsNone(unsupported.search(text))
                for unsupported_field in (
                    "load_skills=",
                    'category="',
                    '"agent_type":',
                    "spawn_subagent.send_input",
                    "spawn_subagent.kill_command_or_subagent",
                ):
                    self.assertNotIn(unsupported_field, text)

    def test_active_ralph_rule_does_not_claim_ulw_triggers(self) -> None:
        rule = (REPO_ROOT / "rules/10-ralph-loop.md").read_text(encoding="utf-8")

        self.assertNotIn("| `/ulw-loop`", rule)
        self.assertNotIn("| `/ultrawork`", rule)
        self.assertIn("They never create Ralph state", rule)
        self.assertIn("/ulw-ralph-loop", rule)

    def test_ulw_loop_command_distinguishes_explicit_ralph_variant(self) -> None:
        command = (REPO_ROOT / "commands/ulw-loop.md").read_text(encoding="utf-8")

        self.assertNotIn("Ralph/ultrawork promise loops", command)
        self.assertIn("/ulw-ralph-loop", command)
        self.assertIn("does not cancel this ULW goal ledger", command)

    def test_active_docs_do_not_register_superpowers_pack(self) -> None:
        paths = [
            "AGENTS.md",
            "hooks/README.md",
            "docs/configuration.md",
            "docs/installation.md",
            "docs/skills.md",
            "docs/troubleshooting.md",
        ]

        for relative in paths:
            with self.subTest(path=relative):
                text = (REPO_ROOT / relative).read_text(encoding="utf-8")
                self.assertNotIn("vendor/superpowers", text)
                self.assertNotIn("`using-superpowers` (first prompt", text)
                self.assertNotIn("state/using-superpowers/", text)

    def test_installation_documents_current_release_bootstrap(self) -> None:
        installation = (REPO_ROOT / "docs/installation.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("ThewindMom/lazygrok@v0.4.4", installation)
        self.assertIn("scripts/install-user-hooks.mjs", installation)
        self.assertIn("ulw-discover.rhai", installation)
        self.assertIn("ulw-review.rhai", installation)
        self.assertNotIn("github:ThewindMom", installation)

    def test_privacy_discloses_every_configured_mcp_and_network_surface(self) -> None:
        privacy = (REPO_ROOT / "docs/PRIVACY.md").read_text(encoding="utf-8")
        configured = json.loads((REPO_ROOT / ".mcp.json").read_text(encoding="utf-8"))

        for name in configured["mcpServers"]:
            with self.subTest(server=name):
                self.assertIn(f"`{name}`", privacy)
        for network_surface in ("grep.app", "Context7", "browsing", "fetch"):
            with self.subTest(surface=network_surface):
                self.assertIn(network_surface, privacy)

    def test_prompt_variants_are_manual_build_time_choices(self) -> None:
        variants = (REPO_ROOT / "docs/PROMPT-VARIANTS.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("manual build-time", variants)
        self.assertNotIn("selected based on the active\nmodel", variants)


if __name__ == "__main__":
    unittest.main()
