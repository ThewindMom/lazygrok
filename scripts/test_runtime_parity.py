import json
import os
import re
import shutil
import signal
import subprocess
import tempfile
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
NODE = "node"
ULW_CLI = ROOT / "vendor/lazygrok-hooks/ulw-loop/dist/cli.js"
EXECUTOR_SHIM = ROOT / "hooks/lazygrok-shim.mjs"
START_WORK_CLI = ROOT / "vendor/lazygrok-hooks/start-work-continuation/dist/cli.js"
LSP_DAEMON_CLI = ROOT / "vendor/lazygrok-hooks/lsp-daemon/dist/cli.js"
LSP_DAEMON_PACKAGE = ROOT / "vendor/lazygrok-hooks/lsp-daemon/package.json"


def run_node(
    argv: list[str],
    *,
    cwd: Path,
    payload: dict[str, object] | None = None,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [NODE, *argv],
        cwd=cwd,
        input=None if payload is None else json.dumps(payload),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=20,
        env=None if env is None else {**os.environ, **env},
    )


def fake_lsp_server_source() -> str:
    return r"""
import { appendFileSync } from "node:fs";

const [, , eventsPath] = process.argv;
let buffer = Buffer.alloc(0);
let pendingDiagnosticId = null;

function record(event) {
  appendFileSync(eventsPath, JSON.stringify(event) + "\n", "utf-8");
}

function send(message) {
  const body = Buffer.from(JSON.stringify(message), "utf-8");
  process.stdout.write("Content-Length: " + body.length + "\r\n\r\n");
  process.stdout.write(body);
}

function handle(message) {
  if (Object.hasOwn(message, "id")) {
    record({ type: "clientRequest", method: message.method, id: message.id });
    if (message.method === "initialize") {
      send({ jsonrpc: "2.0", id: message.id, result: { capabilities: { diagnosticProvider: {} } } });
      return;
    }
    if (message.method === "textDocument/diagnostic") {
      pendingDiagnosticId = message.id;
      return;
    }
    send({ jsonrpc: "2.0", id: message.id, result: null });
    return;
  }
  record({ type: "clientNotification", method: message.method, params: message.params ?? null });
  if (message.method === "$/cancelRequest" && pendingDiagnosticId !== null) {
    const id = pendingDiagnosticId;
    setTimeout(() => {
      record({ type: "serverLateResponse", id });
      send({ jsonrpc: "2.0", id, result: { items: [] } });
    }, 20);
  }
  if (message.method === "exit") process.exit(0);
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  for (;;) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const match = /content-length:\s*(\d+)/i.exec(buffer.subarray(0, headerEnd).toString("ascii"));
    if (!match) process.exit(2);
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) return;
    const body = buffer.subarray(bodyStart, bodyStart + length).toString("utf-8");
    buffer = buffer.subarray(bodyStart + length);
    handle(JSON.parse(body));
  }
});
"""


def wait_for_lsp_event(
    path: Path,
    predicate,
    timeout_seconds: float = 5,
) -> dict[str, object]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        for line in path.read_text(encoding="utf-8").splitlines():
            event = json.loads(line)
            if predicate(event):
                return event
        time.sleep(0.01)
    raise AssertionError(f"timed out waiting for LSP event in {path}")


def stop_packaged_daemon(pid_path: Path) -> None:
    if not pid_path.exists():
        return
    pid = int(pid_path.read_text(encoding="utf-8").strip())
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return
        time.sleep(0.01)


class ShimWorkspaceReadParityTest(unittest.TestCase):
    def test_child_hook_process_does_not_inherit_codex_session_ids(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-shim-env-") as raw:
            fixture = Path(raw)
            workspace = fixture / "workspace"
            plugin = fixture / "plugin"
            component = plugin / "vendor/lazygrok-hooks/capture/dist"
            workspace.mkdir()
            component.mkdir(parents=True)
            component.joinpath("cli.js").write_text(
                """
let body = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { body += chunk; });
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify({
    event: JSON.parse(body),
    env: {
      CODEX_SESSION_ID: process.env.CODEX_SESSION_ID ?? null,
      CODEX_THREAD_ID: process.env.CODEX_THREAD_ID ?? null,
      THREAD_ID: process.env.THREAD_ID ?? null,
      GROK_SESSION_ID: process.env.GROK_SESSION_ID ?? null,
    },
  }));
});
""".strip(),
                encoding="utf-8",
            )
            result = run_node(
                [str(EXECUTOR_SHIM), "capture", "user-prompt-submit"],
                cwd=workspace,
                payload={
                    "hookEventName": "UserPromptSubmit",
                    "sessionId": "exact-grok-session",
                    "workspaceRoot": str(workspace),
                    "prompt": "ulw",
                },
                env={
                    "GROK_PLUGIN_ROOT": str(plugin),
                    "GROK_SESSION_ID": "ambient-grok-session",
                    "CODEX_SESSION_ID": "ambient-codex-session",
                    "CODEX_THREAD_ID": "ambient-codex-thread",
                    "THREAD_ID": "ambient-thread",
                },
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            captured = json.loads(result.stdout)
            self.assertEqual(captured["event"]["session_id"], "exact-grok-session")
            self.assertEqual(
                captured["env"],
                {
                    "CODEX_SESSION_ID": None,
                    "CODEX_THREAD_ID": None,
                    "THREAD_ID": None,
                    "GROK_SESSION_ID": "ambient-grok-session",
                },
            )

    def test_post_tool_enrichment_only_reads_regular_workspace_files(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-shim-read-") as raw:
            fixture = Path(raw)
            workspace = fixture / "workspace"
            plugin = fixture / "plugin"
            component = plugin / "vendor/lazygrok-hooks/capture/dist"
            workspace.mkdir()
            component.mkdir(parents=True)
            component.joinpath("cli.js").write_text(
                "process.stdin.pipe(process.stdout);",
                encoding="utf-8",
            )
            inside = workspace / "inside.ts"
            inside.write_text("const safe = true;\n", encoding="utf-8")
            outside = fixture / "outside.txt"
            outside.write_text("secret-outside-workspace\n", encoding="utf-8")
            symlink = workspace / "linked.txt"
            symlink.symlink_to(outside)

            base = {
                "hookEventName": "PostToolUse",
                "sessionId": "shim-read",
                "cwd": str(workspace),
                "workspaceRoot": str(workspace),
                "toolName": "Write",
            }
            process_env = {"GROK_PLUGIN_ROOT": str(plugin)}

            allowed = run_node(
                [str(EXECUTOR_SHIM), "capture", "post-tool-use"],
                cwd=workspace,
                payload={
                    **base,
                    "transcriptPath": str(outside),
                    "toolInput": {"path": str(inside)},
                },
                env=process_env,
            )
            self.assertEqual(allowed.returncode, 0, allowed.stderr)
            allowed_event = json.loads(allowed.stdout)
            self.assertEqual(
                allowed_event["tool_input"]["content"],
                "const safe = true;\n",
            )
            self.assertIsNone(allowed_event["transcript_path"])

            for forbidden in (outside, Path("..") / "outside.txt", symlink):
                rejected = run_node(
                    [str(EXECUTOR_SHIM), "capture", "post-tool-use"],
                    cwd=workspace,
                    payload={**base, "toolInput": {"path": str(forbidden)}},
                    env=process_env,
                )
                self.assertEqual(rejected.returncode, 0, rejected.stderr)
                self.assertNotIn("content", json.loads(rejected.stdout)["tool_input"])

            oversized = run_node(
                [str(EXECUTOR_SHIM), "capture", "post-tool-use"],
                cwd=workspace,
                payload={
                    **base,
                    "toolInput": {"content": "x" * (10 * 1024 * 1024 + 1)},
                },
                env=process_env,
            )
            self.assertEqual(oversized.returncode, 0, oversized.stderr)
            self.assertEqual(oversized.stdout, "")
            self.assertIn("exceeds 10 MiB", oversized.stderr)


class ExecutorReceiptParityTest(unittest.TestCase):
    def test_native_grok_subagent_stop_is_fail_closed_and_accepts_lazygrok_receipt(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-executor-parity-") as raw:
            workspace = Path(raw)
            base = {
                "hookEventName": "SubagentStop",
                "sessionId": "session-red",
                "cwd": str(workspace),
                "workspaceRoot": str(workspace),
                "subagentId": "agent-red",
                "subagentType": "lazygrok-worker-low",
                "stopHookActive": False,
            }
            blocked = run_node(
                [str(EXECUTOR_SHIM), "lazygrok-executor-verify", "subagent-stop"],
                cwd=workspace,
                payload={**base, "lastAssistantMessage": "done without receipt"},
            )
            self.assertEqual(blocked.returncode, 0, blocked.stderr)
            self.assertEqual(json.loads(blocked.stdout)["decision"], "block")
            self.assertTrue(
                (workspace / ".lazygrok/lazygrok-executor-verify").is_dir()
            )

            transcript = workspace / "transcript.jsonl"
            transcript.write_text("context_length_exceeded\n", encoding="utf-8")
            for attempt in range(2, 4):
                still_blocked = run_node(
                    [
                        str(EXECUTOR_SHIM),
                        "lazygrok-executor-verify",
                        "subagent-stop",
                    ],
                    cwd=workspace,
                    payload={
                        **base,
                        "transcriptPath": str(transcript),
                        "lastAssistantMessage": f"attempt {attempt} without receipt",
                    },
                )
                self.assertEqual(still_blocked.returncode, 0, still_blocked.stderr)
                self.assertEqual(
                    json.loads(still_blocked.stdout)["decision"], "block"
                )
            released = run_node(
                [str(EXECUTOR_SHIM), "lazygrok-executor-verify", "subagent-stop"],
                cwd=workspace,
                payload={
                    **base,
                    "transcriptPath": str(transcript),
                    "lastAssistantMessage": "attempt 4 without receipt",
                },
            )
            self.assertEqual(released.returncode, 0, released.stderr)
            self.assertEqual(released.stdout, "")
            attempt_state = json.loads(
                next(
                    (workspace / ".lazygrok/lazygrok-executor-verify").glob(
                        "session-red-agent-red.json"
                    )
                ).read_text(encoding="utf-8")
            )
            self.assertEqual(attempt_state["attempts"], 0)

            orphan = (
                workspace
                / ".omo/evidence/executors/session-orphan/agent-orphan/receipt.txt"
            )
            orphan.parent.mkdir(parents=True)
            orphan.write_text("not an active legacy run\n", encoding="utf-8")
            orphan_result = run_node(
                [
                    str(EXECUTOR_SHIM),
                    "lazygrok-executor-verify",
                    "subagent-stop",
                ],
                cwd=workspace,
                payload={
                    **base,
                    "sessionId": "session-orphan",
                    "subagentId": "agent-orphan",
                    "lastAssistantMessage": (
                        "complete\nEVIDENCE_RECORDED: "
                        ".omo/evidence/executors/session-orphan/"
                        "agent-orphan/receipt.txt"
                    ),
                },
            )
            self.assertEqual(orphan_result.returncode, 0, orphan_result.stderr)
            self.assertEqual(json.loads(orphan_result.stdout)["decision"], "block")

            broad_receipt = workspace / ".lazygrok/evidence/broad.txt"
            broad_receipt.parent.mkdir(parents=True, exist_ok=True)
            broad_receipt.write_text("too broadly scoped\n", encoding="utf-8")
            broad_result = run_node(
                [
                    str(EXECUTOR_SHIM),
                    "lazygrok-executor-verify",
                    "subagent-stop",
                ],
                cwd=workspace,
                payload={
                    **base,
                    "sessionId": "session-broad",
                    "subagentId": "agent-broad",
                    "lastAssistantMessage": (
                        "complete\nEVIDENCE_RECORDED: "
                        ".lazygrok/evidence/broad.txt"
                    ),
                },
            )
            self.assertEqual(broad_result.returncode, 0, broad_result.stderr)
            self.assertEqual(json.loads(broad_result.stdout)["decision"], "block")

            legacy_receipt = (
                workspace
                / ".omo/evidence/executors/session-legacy/"
                "agent-legacy/receipt.txt"
            )
            legacy_receipt.parent.mkdir(parents=True)
            legacy_receipt.write_text("verified legacy run\n", encoding="utf-8")
            legacy_goals = workspace / ".omo/ulw-loop/session-legacy/goals.json"
            legacy_goals.parent.mkdir(parents=True)
            legacy_goals.write_text("{}\n", encoding="utf-8")
            canonical_other = workspace / ".lazygrok/ulw-loop/other/goals.json"
            canonical_other.parent.mkdir(parents=True)
            canonical_other.write_text("{}\n", encoding="utf-8")
            legacy_accepted = run_node(
                [
                    str(EXECUTOR_SHIM),
                    "lazygrok-executor-verify",
                    "subagent-stop",
                ],
                cwd=workspace,
                payload={
                    **base,
                    "sessionId": "session-legacy",
                    "subagentId": "agent-legacy",
                    "lastAssistantMessage": (
                        "complete\nEVIDENCE_RECORDED: "
                        ".omo/evidence/executors/session-legacy/"
                        "agent-legacy/receipt.txt"
                    ),
                },
            )
            self.assertEqual(legacy_accepted.returncode, 0, legacy_accepted.stderr)
            self.assertEqual(legacy_accepted.stdout, "")

            receipt = (
                workspace
                / ".lazygrok/evidence/executors/session-green/"
                "agent-green/receipt.txt"
            )
            receipt.parent.mkdir(parents=True)
            receipt.write_text("verified\n", encoding="utf-8")
            accepted = run_node(
                [str(EXECUTOR_SHIM), "lazygrok-executor-verify", "subagent-stop"],
                cwd=workspace,
                payload={
                    **base,
                    "sessionId": "session-green",
                    "subagentId": "agent-green",
                    "lastAssistantMessage": (
                        "complete\nEVIDENCE_RECORDED: "
                        ".lazygrok/evidence/executors/session-green/"
                        "agent-green/receipt.txt"
                    ),
                },
            )
            self.assertEqual(accepted.returncode, 0, accepted.stderr)
            self.assertEqual(accepted.stdout, "")

    def test_symlinked_executor_state_root_cannot_write_outside_workspace(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-executor-root-") as raw:
            fixture = Path(raw)
            workspace = fixture / "workspace"
            outside = fixture / "outside"
            workspace.mkdir()
            outside.mkdir()
            (workspace / ".lazygrok").symlink_to(outside, target_is_directory=True)

            result = run_node(
                [str(EXECUTOR_SHIM), "lazygrok-executor-verify", "subagent-stop"],
                cwd=workspace,
                payload={
                    "hookEventName": "SubagentStop",
                    "sessionId": "session-link",
                    "cwd": str(workspace),
                    "workspaceRoot": str(workspace),
                    "subagentId": "agent-link",
                    "subagentType": "lazygrok-worker-low",
                    "stopHookActive": False,
                    "lastAssistantMessage": "done without receipt",
                },
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["decision"], "block")
            self.assertFalse(
                (outside / "lazygrok-executor-verify/session-link-agent-link.json").exists()
            )


class StateBoundaryParityTest(unittest.TestCase):
    def test_ulw_direct_hook_stdin_is_bounded(self) -> None:
        payloads: dict[str, dict[str, object]] = {
            "user-prompt-submit": {
                "hook_event_name": "UserPromptSubmit",
                "cwd": "/tmp",
                "prompt": "x" * (10 * 1024 * 1024),
                "session_id": "bounded-input",
            },
            "pre-tool-use": {
                "hook_event_name": "PreToolUse",
                "cwd": "/tmp",
                "model": "gpt-5.6",
                "permission_mode": "default",
                "session_id": "bounded-input",
                "tool_input": {
                    "objective": "x" * (10 * 1024 * 1024),
                    "token_budget": 1,
                },
                "tool_name": "create_goal",
                "tool_use_id": "tool-1",
                "transcript_path": None,
                "turn_id": "turn-1",
            },
        }
        for hook_name, payload in payloads.items():
            with self.subTest(hook=hook_name):
                result = run_node(
                    [str(ULW_CLI), "hook", hook_name],
                    cwd=ROOT,
                    payload=payload,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, "")

    @unittest.skipIf(os.name == "nt", "hard-link boundary is exercised on Grok/Linux")
    def test_state_and_receipt_hard_links_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-hardlink-") as raw:
            fixture = Path(raw)
            workspace = fixture / "workspace"
            outside = fixture / "outside"
            workspace.mkdir()
            outside.mkdir()

            executor_state = (
                workspace
                / ".lazygrok/lazygrok-executor-verify/session-link-agent-link.json"
            )
            executor_state.parent.mkdir(parents=True)
            outside_state = outside / "attempts.json"
            outside_state.write_text('{"attempts":3}\n', encoding="utf-8")
            os.link(outside_state, executor_state)
            payload: dict[str, object] = {
                "hookEventName": "SubagentStop",
                "sessionId": "session-link",
                "cwd": str(workspace),
                "workspaceRoot": str(workspace),
                "subagentId": "agent-link",
                "subagentType": "lazygrok-worker-low",
                "stopHookActive": False,
                "lastAssistantMessage": "done without receipt",
            }
            executor_results = [
                run_node(
                    [
                        str(EXECUTOR_SHIM),
                        "lazygrok-executor-verify",
                        "subagent-stop",
                    ],
                    cwd=workspace,
                    payload=payload,
                )
                for _ in range(4)
            ]
            for executor in executor_results:
                self.assertEqual(executor.returncode, 0, executor.stderr)
            self.assertEqual(
                [
                    json.loads(executor.stdout)["decision"]
                    for executor in executor_results[:3]
                ],
                ["block", "block", "block"],
            )
            self.assertEqual(executor_results[3].stdout, "")
            self.assertEqual(
                outside_state.read_text(encoding="utf-8"), '{"attempts":3}\n'
            )

            receipt = (
                workspace
                / ".lazygrok/evidence/executors/session-receipt/agent-receipt/receipt.txt"
            )
            receipt.parent.mkdir(parents=True)
            outside_receipt = outside / "receipt.txt"
            outside_receipt.write_text("external receipt\n", encoding="utf-8")
            os.link(outside_receipt, receipt)
            receipt_result = run_node(
                [str(EXECUTOR_SHIM), "lazygrok-executor-verify", "subagent-stop"],
                cwd=workspace,
                payload={
                    "hookEventName": "SubagentStop",
                    "sessionId": "session-receipt",
                    "cwd": str(workspace),
                    "workspaceRoot": str(workspace),
                    "subagentId": "agent-receipt",
                    "subagentType": "lazygrok-worker-low",
                    "stopHookActive": False,
                    "lastAssistantMessage": (
                        "done\nEVIDENCE_RECORDED: "
                        ".lazygrok/evidence/executors/session-receipt/"
                        "agent-receipt/receipt.txt"
                    ),
                },
            )
            self.assertEqual(receipt_result.returncode, 0, receipt_result.stderr)
            self.assertEqual(
                json.loads(receipt_result.stdout)["decision"], "block"
            )

    def test_symlinked_ulw_state_roots_deny_spawn_without_external_write(
        self,
    ) -> None:
        for root_name in (".lazygrok", ".omo"):
            with self.subTest(root=root_name):
                with tempfile.TemporaryDirectory(prefix="lazygrok-ulw-root-") as raw:
                    fixture = Path(raw)
                    workspace = fixture / "workspace"
                    outside = fixture / "outside"
                    session = outside / "ulw-loop/s1"
                    workspace.mkdir()
                    session.mkdir(parents=True)
                    (session / "goals.json").write_text("{}\n", encoding="utf-8")
                    (workspace / root_name).symlink_to(
                        outside, target_is_directory=True
                    )
                    result = run_node(
                        [str(ULW_CLI), "hook", "pre-tool-use-spawn"],
                        cwd=workspace,
                        payload={
                            "hook_event_name": "PreToolUse",
                            "session_id": "s1",
                            "turn_id": "t1",
                            "transcript_path": None,
                            "cwd": str(workspace),
                            "model": "gpt-5.6",
                            "permission_mode": "default",
                            "tool_name": "spawn_subagent",
                            "tool_use_id": "tu1",
                            "tool_input": {"message": "scan"},
                        },
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    output = json.loads(result.stdout)["hookSpecificOutput"]
                    self.assertEqual(output["permissionDecision"], "deny")
                    self.assertFalse((session / "spawn-count.json").exists())

    def test_cli_file_inputs_stay_inside_workspace(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-cli-input-") as raw:
            fixture = Path(raw)
            workspace = fixture / "workspace"
            workspace.mkdir()
            outside = fixture / "outside-brief.txt"
            outside.write_text("outside secret\n", encoding="utf-8")

            rejected = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--session-id",
                    "boundary",
                    "--brief-file",
                    str(outside),
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertNotEqual(rejected.returncode, 0)
            self.assertFalse(
                (workspace / ".lazygrok/ulw-loop/boundary/brief.md").exists()
            )

            inside = workspace / "brief.txt"
            inside.write_text("inside brief\n", encoding="utf-8")
            accepted = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--session-id",
                    "boundary",
                    "--brief-file",
                    "brief.txt",
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(accepted.returncode, 0, accepted.stderr)
            self.assertTrue(
                (workspace / ".lazygrok/ulw-loop/boundary/brief.md").is_file()
            )


class LightGateProvenanceParityTest(unittest.TestCase):
    def test_light_gate_identifies_root_self_review_without_fake_reviewers(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-light-gate-") as raw:
            workspace = Path(raw)
            session_id = "light-provenance"
            created = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--brief",
                    "Verify one small generated runtime behavior",
                    "--session-id",
                    session_id,
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(created.returncode, 0, created.stderr)
            plan = json.loads(created.stdout)["plan"]
            self.assertTrue(plan["briefPath"].startswith(".lazygrok/ulw-loop/"))
            self.assertTrue(plan["goalsPath"].startswith(".lazygrok/ulw-loop/"))
            self.assertTrue(plan["ledgerPath"].startswith(".lazygrok/ulw-loop/"))
            goal = plan["goals"][0]
            for criterion in goal["successCriteria"]:
                recorded = run_node(
                    [
                        str(ULW_CLI),
                        "record-evidence",
                        "--session-id",
                        session_id,
                        "--goal-id",
                        goal["id"],
                        "--criterion-id",
                        criterion["id"],
                        "--status",
                        "pass",
                        "--evidence",
                        f"observable pass for {criterion['id']}",
                        "--json",
                    ],
                    cwd=workspace,
                )
                self.assertEqual(recorded.returncode, 0, recorded.stderr)

            generated = run_node(
                [
                    str(ULW_CLI),
                    "light-quality-gate",
                    "--session-id",
                    session_id,
                    "--goal-id",
                    goal["id"],
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(generated.returncode, 0, generated.stderr)
            generated_payload = json.loads(generated.stdout)
            self.assertTrue(
                generated_payload["qualityGatePath"].startswith(
                    ".lazygrok/evidence/"
                )
            )
            gate = generated_payload["qualityGate"]
            self.assertEqual(
                gate["provenance"],
                {
                    "mode": "root-self-review",
                    "producer": "lazygrok-root",
                    "sessionId": session_id,
                },
            )
            self.assertEqual(gate["codeReview"]["by"], "lazygrok-root")
            self.assertEqual(gate["manualQa"]["by"], "lazygrok-root")
            self.assertEqual(gate["gateReview"]["by"], "lazygrok-root")
            checkpointed = run_node(
                [
                    str(ULW_CLI),
                    "checkpoint",
                    "--session-id",
                    session_id,
                    "--goal-id",
                    goal["id"],
                    "--status",
                    "complete",
                    "--evidence",
                    "root self-review and observable criterion evidence passed",
                    "--codex-goal-json",
                    json.dumps(
                        {
                            "status": "complete",
                            "objective": plan["codexObjective"],
                        }
                    ),
                    "--quality-gate-json",
                    json.loads(generated.stdout)["qualityGatePath"],
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(checkpointed.returncode, 0, checkpointed.stderr)
            self.assertTrue(json.loads(checkpointed.stdout)["ok"])


class StateRootAndCatalogParityTest(unittest.TestCase):
    def test_deployed_ulw_adapter_blocks_incomplete_aggregate_without_transcript(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-ulw-no-transcript-") as raw:
            workspace = Path(raw)
            session_id = "aggregate-final-gate"
            created = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--brief",
                    "Finish the aggregate quality gate",
                    "--session-id",
                    session_id,
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(created.returncode, 0, created.stderr)
            plan_path = (
                workspace / ".lazygrok/ulw-loop" / session_id / "goals.json"
            )
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            for goal in plan["goals"]:
                goal["status"] = "complete"
            plan.pop("aggregateCompletion", None)
            plan_path.write_text(f"{json.dumps(plan)}\n", encoding="utf-8")

            result = run_node(
                [str(EXECUTOR_SHIM), "ulw-loop", "stop"],
                cwd=workspace,
                payload={
                    "hookEventName": "Stop",
                    "sessionId": session_id,
                    "workspaceRoot": str(workspace),
                    "stopHookActive": False,
                },
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["decision"], "block")

    def test_deployed_start_work_adapter_blocks_final_gate_without_transcript(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(
            prefix="lazygrok-start-work-no-transcript-"
        ) as raw:
            workspace = Path(raw)
            plan_path = workspace / ".lazygrok/plans/test.md"
            plan_path.parent.mkdir(parents=True)
            plan_path.write_text(
                "## TODOs\n- [x] 1. implementation complete\n", encoding="utf-8"
            )
            boulder = {
                "schema_version": 2,
                "active_work_id": "w1",
                "works": {
                    "w1": {
                        "work_id": "w1",
                        "active_plan": ".lazygrok/plans/test.md",
                        "plan_name": "test",
                        "session_ids": ["grok:session-one"],
                        "status": "active",
                    }
                },
            }
            (workspace / ".lazygrok/boulder.json").write_text(
                json.dumps(boulder), encoding="utf-8"
            )

            result = run_node(
                [str(EXECUTOR_SHIM), "start-work-continuation", "stop"],
                cwd=workspace,
                payload={
                    "hookEventName": "Stop",
                    "sessionId": "session-one",
                    "workspaceRoot": str(workspace),
                    "stopHookActive": False,
                },
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["decision"], "block")

    def test_ulw_loop_never_uses_a_parent_codex_session_for_grok_state(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-session-scope-") as raw:
            workspace = Path(raw)
            created = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--brief",
                    "Keep Grok state isolated",
                    "--json",
                ],
                cwd=workspace,
                env={
                    "CODEX_SESSION_ID": "parent-codex-session",
                    "GROK_SESSION_ID": "current-grok-session",
                },
            )

            self.assertEqual(created.returncode, 0, created.stderr)
            self.assertTrue(
                (
                    workspace
                    / ".lazygrok/ulw-loop/current-grok-session/goals.json"
                ).is_file()
            )
            self.assertFalse(
                (
                    workspace
                    / ".lazygrok/ulw-loop/parent-codex-session/goals.json"
                ).exists()
            )

    def test_ulw_loop_preserves_an_existing_legacy_state_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-legacy-ulw-") as raw:
            workspace = Path(raw)
            session_id = "legacy-session"
            created = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--brief",
                    "Resume a legacy run",
                    "--session-id",
                    session_id,
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(created.returncode, 0, created.stderr)
            canonical = workspace / ".lazygrok/ulw-loop" / session_id
            legacy = workspace / ".omo/ulw-loop" / session_id
            legacy.parent.mkdir(parents=True)
            plan_path = canonical / "goals.json"
            plan = json.loads(plan_path.read_text(encoding="utf-8"))
            plan["briefPath"] = f".omo/ulw-loop/{session_id}/brief.md"
            plan["goalsPath"] = f".omo/ulw-loop/{session_id}/goals.json"
            plan["ledgerPath"] = f".omo/ulw-loop/{session_id}/ledger.jsonl"
            plan_path.write_text(f"{json.dumps(plan, indent=2)}\n", encoding="utf-8")
            canonical.rename(legacy)

            status = run_node(
                [
                    str(ULW_CLI),
                    "status",
                    "--session-id",
                    session_id,
                    "--json",
                ],
                cwd=workspace,
            )

            self.assertEqual(status.returncode, 0, status.stderr)
            self.assertEqual(
                json.loads(status.stdout)["plan"]["goalsPath"],
                f".omo/ulw-loop/{session_id}/goals.json",
            )
            self.assertTrue((legacy / "goals.json").is_file())
            self.assertFalse((canonical / "goals.json").exists())

    def test_ulw_stop_refire_stays_blocking_under_grok_retry_semantics(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-ulw-stop-refire-") as raw:
            workspace = Path(raw)
            session_id = "grok-stop-refire"
            created = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--brief",
                    "Finish a pending Grok ULW goal",
                    "--session-id",
                    session_id,
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(created.returncode, 0, created.stderr)
            result = run_node(
                [str(ULW_CLI), "hook", "stop"],
                cwd=workspace,
                payload={
                    "session_id": session_id,
                    "turn_id": session_id,
                    "transcript_path": "",
                    "cwd": str(workspace),
                    "hook_event_name": "Stop",
                    "model": "grok-build",
                    "permission_mode": "default",
                    "stop_hook_active": True,
                },
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["decision"], "block")

    def test_ulw_stop_refire_tracks_growth_in_a_large_valid_ledger(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-ulw-large-ledger-") as raw:
            workspace = Path(raw)
            session_id = "grok-large-ledger"
            created = run_node(
                [
                    str(ULW_CLI),
                    "create-goals",
                    "--brief",
                    "Finish a pending Grok ULW goal with a large ledger",
                    "--session-id",
                    session_id,
                    "--json",
                ],
                cwd=workspace,
            )
            self.assertEqual(created.returncode, 0, created.stderr)
            goal_id = json.loads(created.stdout)["plan"]["goals"][0]["id"]
            state_dir = workspace / ".lazygrok/ulw-loop" / session_id
            ledger = state_dir / "ledger.jsonl"
            ledger.write_text(
                "{}\n" * ((10 * 1024 * 1024 + 3) // 3),
                encoding="utf-8",
            )
            payload: dict[str, object] = {
                "session_id": session_id,
                "turn_id": session_id,
                "transcript_path": "",
                "cwd": str(workspace),
                "hook_event_name": "Stop",
                "model": "grok-build",
                "permission_mode": "default",
                "stop_hook_active": True,
            }
            first = run_node(
                [str(ULW_CLI), "hook", "stop"], cwd=workspace, payload=payload
            )
            with ledger.open("a", encoding="utf-8") as stream:
                stream.write('{"kind":"goal_started"}\n')
            second = run_node(
                [str(ULW_CLI), "hook", "stop"], cwd=workspace, payload=payload
            )
            counter = json.loads(
                (state_dir / f"auto-resume-{goal_id}.json").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual(json.loads(first.stdout)["decision"], "block")
            self.assertEqual(json.loads(second.stdout)["decision"], "block")
            self.assertEqual(counter["count"], 1)
            self.assertGreater(counter["ledgerLineCount"], 0)

    def test_start_work_continuation_reads_lazygrok_boulder(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-start-work-") as raw:
            workspace = Path(raw)
            plan_path = workspace / ".lazygrok/plans/test.md"
            plan_path.parent.mkdir(parents=True)
            plan_path.write_text(
                "## TODOs\n- [ ] 1. finish parity\n", encoding="utf-8"
            )
            boulder = {
                "schema_version": 2,
                "active_work_id": "w1",
                "works": {
                    "w1": {
                        "work_id": "w1",
                        "active_plan": ".lazygrok/plans/test.md",
                        "plan_name": "test",
                        "session_ids": ["grok:session-one"],
                        "status": "active",
                    }
                },
            }
            (workspace / ".lazygrok/boulder.json").write_text(
                json.dumps(boulder), encoding="utf-8"
            )
            result = run_node(
                [str(START_WORK_CLI), "hook", "stop"],
                cwd=workspace,
                payload={
                    "session_id": "session-one",
                    "turn_id": "turn-one",
                    "transcript_path": "",
                    "cwd": str(workspace),
                    "hook_event_name": "Stop",
                    "model": "grok-build",
                    "permission_mode": "default",
                    "stop_hook_active": False,
                },
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["decision"], "block")

    def test_start_work_rejects_oversized_boulder_and_plan_inputs(self) -> None:
        for oversized_surface in ("boulder", "plan"):
            with self.subTest(oversized_surface=oversized_surface):
                with tempfile.TemporaryDirectory(
                    prefix="lazygrok-start-work-bounds-"
                ) as raw:
                    workspace = Path(raw)
                    plan_path = workspace / ".lazygrok/plans/test.md"
                    plan_path.parent.mkdir(parents=True)
                    plan_text = "## TODOs\n- [ ] 1. finish parity\n"
                    if oversized_surface == "plan":
                        plan_text += " " * (10 * 1024 * 1024)
                    plan_path.write_text(plan_text, encoding="utf-8")
                    boulder = {
                        "works": {
                            "w1": {
                                "active_plan": ".lazygrok/plans/test.md",
                                "plan_name": "test",
                                "session_ids": ["grok:session-one"],
                                "status": "active",
                            }
                        }
                    }
                    boulder_text = json.dumps(boulder)
                    if oversized_surface == "boulder":
                        boulder_text += " " * (1024 * 1024)
                    (workspace / ".lazygrok/boulder.json").write_text(
                        boulder_text, encoding="utf-8"
                    )
                    result = run_node(
                        [str(START_WORK_CLI), "hook", "stop"],
                        cwd=workspace,
                        payload={
                            "session_id": "session-one",
                            "turn_id": "turn-one",
                            "transcript_path": "",
                            "cwd": str(workspace),
                            "hook_event_name": "Stop",
                            "model": "grok-build",
                            "permission_mode": "default",
                            "stop_hook_active": False,
                        },
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(result.stdout, "")

    def test_start_work_selects_the_root_that_owns_the_session(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-start-work-mixed-") as raw:
            workspace = Path(raw)
            legacy_plan = workspace / ".omo/plans/legacy.md"
            legacy_plan.parent.mkdir(parents=True)
            legacy_plan.write_text(
                "## TODOs\n- [ ] 1. continue legacy\n", encoding="utf-8"
            )
            canonical_plan = workspace / ".lazygrok/plans/other.md"
            canonical_plan.parent.mkdir(parents=True)
            canonical_plan.write_text(
                "## TODOs\n- [ ] 1. unrelated\n", encoding="utf-8"
            )
            for root, session_id, plan in (
                (".lazygrok", "other-session", ".lazygrok/plans/other.md"),
                (".omo", "legacy-session", ".omo/plans/legacy.md"),
            ):
                boulder_path = workspace / root / "boulder.json"
                boulder_path.write_text(
                    json.dumps(
                        {
                            "works": {
                                session_id: {
                                    "active_plan": plan,
                                    "plan_name": session_id,
                                    "session_ids": [f"grok:{session_id}"],
                                    "status": "active",
                                }
                            }
                        }
                    ),
                    encoding="utf-8",
                )
            result = run_node(
                [str(START_WORK_CLI), "hook", "stop"],
                cwd=workspace,
                payload={
                    "session_id": "legacy-session",
                    "turn_id": "turn-legacy",
                    "transcript_path": "",
                    "cwd": str(workspace),
                    "hook_event_name": "Stop",
                    "model": "grok-build",
                    "permission_mode": "default",
                    "stop_hook_active": False,
                },
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            parsed = json.loads(result.stdout)
            self.assertEqual(parsed["decision"], "block")
            self.assertIn(".omo/plans/legacy.md", parsed["reason"])

    def test_registered_skill_roots_expose_one_start_work(self) -> None:
        manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
        names: list[Path] = []
        for configured_root in manifest["skills"]:
            skill_root = ROOT / configured_root
            for skill_file in skill_root.glob("*/SKILL.md"):
                frontmatter = skill_file.read_text(encoding="utf-8").split("---", 2)
                if len(frontmatter) < 3:
                    continue
                if any(
                    line.strip() == "name: start-work"
                    for line in frontmatter[1].splitlines()
                ):
                    names.append(skill_file.relative_to(ROOT))
        self.assertEqual(names, [Path("skills/start-work-execution/SKILL.md")])


class GeneratedRuntimeParityTest(unittest.TestCase):
    def test_lsp_bundle_emits_json_rpc_cancellation(self) -> None:
        with tempfile.TemporaryDirectory(prefix="lazygrok-lsp-cancel-") as raw:
            fixture = Path(raw)
            packaged = fixture / "package"
            packaged_dist = packaged / "dist"
            packaged_dist.mkdir(parents=True)
            packaged_cli = packaged_dist / "cli.js"
            shutil.copy2(LSP_DAEMON_CLI, packaged_cli)
            shutil.copy2(LSP_DAEMON_PACKAGE, packaged / "package.json")

            workspace = fixture / "workspace"
            workspace.mkdir()
            source = workspace / "source.ts"
            source.write_text("const value: number = 1;\n", encoding="utf-8")
            events = fixture / "events.jsonl"
            events.write_text("", encoding="utf-8")
            fake_server = fixture / "fake-lsp-server.mjs"
            fake_server.write_text(fake_lsp_server_source(), encoding="utf-8")
            config = fixture / "lsp-client.json"
            config.write_text(
                json.dumps(
                    {
                        "lsp": {
                            "parity": {
                                "command": [NODE, str(fake_server), str(events)],
                                "extensions": [".ts"],
                                "priority": 100,
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )

            daemon_root = fixture / "daemon"
            process = subprocess.Popen(
                [NODE, str(packaged_cli), "mcp"],
                cwd=workspace,
                env={
                    **os.environ,
                    "OMO_LSP_DAEMON_CLI": str(packaged_cli),
                    "OMO_LSP_DAEMON_DIR": str(daemon_root),
                    "OMO_LSP_DAEMON_VERSION": "parity-test",
                    "LSP_TOOLS_MCP_USER_CONFIG": str(config),
                },
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            try:
                process_stdin = process.stdin
                if process_stdin is None:
                    raise AssertionError("packaged LSP stdin pipe was not created")
                process_stdin.write(
                    json.dumps(
                        {
                            "jsonrpc": "2.0",
                            "id": 17,
                            "method": "tools/call",
                            "params": {
                                "name": "diagnostics",
                                "arguments": {
                                    "filePath": str(source),
                                    "severity": "error",
                                },
                            },
                        }
                    )
                    + "\n"
                )
                process_stdin.flush()
                request = wait_for_lsp_event(
                    events,
                    lambda event: event.get("method") == "textDocument/diagnostic",
                )
                process_stdin.close()
                process.stdin = None
                stdout, stderr = process.communicate(timeout=10)
                self.assertEqual(process.returncode, 0, stderr)

                cancellation = wait_for_lsp_event(
                    events,
                    lambda event: event.get("method") == "$/cancelRequest",
                )
                late_response = wait_for_lsp_event(
                    events,
                    lambda event: event.get("type") == "serverLateResponse",
                )
                responses = [
                    json.loads(line)
                    for line in stdout.splitlines()
                    if line.strip()
                ]
                self.assertEqual(
                    cancellation.get("params"),
                    {"id": request.get("id")},
                )
                self.assertEqual(late_response.get("id"), request.get("id"))
                self.assertEqual(len(responses), 1)
                self.assertEqual(responses[0]["id"], 17)
                self.assertTrue(responses[0]["result"]["isError"])
                self.assertIn(
                    "cancel",
                    responses[0]["result"]["content"][0]["text"].lower(),
                )
            finally:
                stop_packaged_daemon(daemon_root / "vparity-test" / "daemon.pid")
                if process.poll() is None:
                    process.kill()
                    process.wait(timeout=5)

    def test_active_ulw_loop_skill_copies_are_identical(self) -> None:
        copies = [
            ROOT / "skills/ulw-loop/SKILL.md",
            ROOT / "vendor/lazygrok-skills/ulw-loop/SKILL.md",
            ROOT
            / "vendor/lazygrok-hooks/ulw-loop/skills/ulw-loop/SKILL.md",
        ]
        contents = [path.read_bytes() for path in copies]
        self.assertTrue(all(content == contents[0] for content in contents[1:]))

    def test_active_ulw_plan_skill_copies_are_identical(self) -> None:
        copies = [
            ROOT / "skills/ulw-plan",
            ROOT / "vendor/lazygrok-skills/ulw-plan",
            ROOT / "vendor/lazygrok-hooks/ultrawork/skills/ulw-plan",
        ]
        canonical_files = sorted(
            path.relative_to(copies[0]) for path in copies[0].rglob("*") if path.is_file()
        )
        for mirror in copies[1:]:
            mirror_files = sorted(
                path.relative_to(mirror) for path in mirror.rglob("*") if path.is_file()
            )
            self.assertEqual(mirror_files, canonical_files)
            for relative_path in canonical_files:
                self.assertEqual(
                    (mirror / relative_path).read_bytes(),
                    (copies[0] / relative_path).read_bytes(),
                )

    def test_active_grok_skills_do_not_require_missing_image_view_tools(self) -> None:
        manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
        offenders: list[str] = []
        for configured_root in manifest["skills"]:
            skill_root = ROOT / configured_root
            for path in skill_root.rglob("*.md"):
                text = path.read_text(encoding="utf-8")
                if "`view_image`" in text or "`look_at`" in text:
                    offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual(offenders, [])

    def test_active_grok_skills_and_hooks_do_not_route_to_codex_team_tools(
        self,
    ) -> None:
        manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
        unsupported = re.compile(
            r"\bcodex_app\."
            r"|\bteam_mode\b"
            r"|\bmulti_agent_v[12]\b"
            r"|(?:\bcall_omo_agent|\bbackground_output)\s*\("
            r"|\b(?:Task|task)\s*\("
            r"(?=\s*(?:subagent_type|category|description|prompt|load_skills)\s*=)"
            r"|\bload_skills="
            r'|\bcategory="'
            r'|"agent_type"\s*:'
            r"|spawn_subagent\.(?:send_input|kill_command_or_subagent)"
            r"|\bteam_(?:create|task_create|status|list|delete|shutdown_request|"
            r"approve_shutdown|send_message)\b"
        )
        offenders: list[str] = []
        seen: set[Path] = set()
        for configured_root in manifest["skills"]:
            active_root = ROOT / configured_root
            paths = set(active_root.rglob("*.md"))
            paths.update(active_root.rglob("hooks.json"))
            teammode_root = active_root / "teammode"
            if teammode_root.exists():
                paths.update(path for path in teammode_root.rglob("*") if path.is_file())
            for path in sorted(paths):
                if path in seen:
                    continue
                seen.add(path)
                for line_number, line in enumerate(
                    path.read_text(encoding="utf-8").splitlines(), 1
                ):
                    if unsupported.search(line) or (
                        path.name == "hooks.json"
                        and ("create_thread" in line or "teammode post-tool-use" in line)
                    ):
                        offenders.append(
                            f"{path.relative_to(ROOT)}:{line_number}: {line.strip()}"
                        )

        hooks = (ROOT / "hooks/hooks.json").read_text(encoding="utf-8")
        self.assertNotIn("teammode post-tool-use", hooks)
        self.assertNotIn("create_thread", hooks)
        self.assertNotIn("codex_app", hooks)
        self.assertNotIn("telemetry session-start", hooks)
        self.assertFalse((ROOT / "vendor/lazygrok-hooks/teammode").exists())
        self.assertFalse((ROOT / "vendor/lazygrok-hooks/telemetry").exists())
        self.assertEqual(
            sorted(
                path.relative_to(ROOT / "vendor/lazygrok-skills/teammode")
                for path in (ROOT / "vendor/lazygrok-skills/teammode").rglob("*")
                if path.is_file()
            ),
            [Path("SKILL.md")],
        )
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
