#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

import { adaptImpeccableStopOutput } from "./impeccable-stop-output.mjs";

const input = await readStdin();
const result = spawnSync(
  process.execPath,
  [".agents/skills/impeccable/scripts/hook.mjs"],
  {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: { ...process.env, IMPECCABLE_HOOK_HARNESS: "codex" },
    input,
  }
);

if (result.error) {
  process.stderr.write(result.error.message);
  process.exit(1);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

const output = adaptImpeccableStopOutput(result.stdout ?? "");
if (output) {
  process.stdout.write(output);
}
process.exit(result.status ?? 0);

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
