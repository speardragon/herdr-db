#!/usr/bin/env node
// Claude Code and Codex PreToolUse / PostToolUse(/PostToolUseFailure) hook for MongoDB MCP tool calls.
// It must never block or fail the agent's tool call: no stdout, always exit 0.
import { runHook } from '../src/hook.mjs';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', async () => {
  await runHook(input);
  process.exit(0);
});
