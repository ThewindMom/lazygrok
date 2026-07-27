#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "node:process";
import { homedir } from "node:os";
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const realShim = resolve(__dirname, "lazygrok-shim.mjs");
const args = process.argv.slice(2);

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  const raw = Buffer.concat(chunks);
  try {
    const dir = join(homedir(), ".grok/state/lazygrok");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(dir, `ups-stdin-${stamp}.bin`), raw);
    writeFileSync(
      join(dir, "ups-stdin-latest.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          args,
          env: {
            GROK_HOOK_EVENT: env.GROK_HOOK_EVENT || null,
            GROK_HOOK_NAME: env.GROK_HOOK_NAME || null,
            GROK_SESSION_ID: env.GROK_SESSION_ID || null,
            GROK_WORKSPACE_ROOT: env.GROK_WORKSPACE_ROOT || null,
            GROK_PLUGIN_ROOT: env.GROK_PLUGIN_ROOT || null,
          },
          stdinBytes: raw.length,
          stdinUtf8: raw.toString("utf8"),
        },
        null,
        2,
      ),
    );
    appendFileSync(
      join(dir, "ups-stdin.log"),
      `${new Date().toISOString()} bytes=${raw.length} args=${args.join(" ")} envEvent=${env.GROK_HOOK_EVENT} session=${env.GROK_SESSION_ID}\n${raw.toString("utf8")}\n---\n`,
    );
  } catch (e) {
    // ignore
  }
  const child = spawn(process.execPath, [realShim, ...args], {
    stdio: ["pipe", "inherit", "inherit"],
    env,
  });
  child.stdin.write(raw);
  child.stdin.end();
  child.on("exit", (code) => process.exit(code || 0));
});
