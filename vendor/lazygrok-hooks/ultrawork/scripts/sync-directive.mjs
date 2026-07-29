#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const componentRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repositoryRoot = dirname(dirname(dirname(componentRoot)));
const grokPromptPath = join(repositoryRoot, "prompts", "ultrawork", "grok.md");
const directivePath = join(componentRoot, "directive.md");

const grokPrompt = await readFile(grokPromptPath, "utf8");
await writeFile(directivePath, grokPrompt);
