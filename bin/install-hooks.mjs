#!/usr/bin/env node
// Registers the herdr-db hooks for Claude Code (~/.claude/settings.json) and Codex (~/.codex/hooks.json).
// Usage: install-hooks.mjs [--agent=claude|codex|all]   (default: every agent found on this machine)
import path from 'node:path';
import { AGENTS, AGENT_IDS, detectedAgents, isAgent } from '../src/agents.mjs';
import { PLUGIN_ROOT } from '../src/config.mjs';
import { addHooks, hookCommand, installedHooks, readSettings, writeSettings } from '../src/settings.mjs';

function requestedAgents(argv) {
  const value = argv.find((arg) => arg.startsWith('--agent='))?.slice('--agent='.length);
  if (!value) return detectedAgents().length ? detectedAgents() : ['claude'];
  if (value === 'all') return AGENT_IDS;
  if (!isAgent(value)) throw new Error(`unknown agent "${value}" (expected ${AGENT_IDS.join(', ')} or all)`);
  return [value];
}

function install(id) {
  const agent = AGENTS[id];
  const file = agent.hooksFile();
  const command = hookCommand(process.execPath, path.join(PLUGIN_ROOT, 'bin', 'hook.mjs'), id);
  const next = addHooks(readSettings(file), command, id);
  writeSettings(file, next);
  console.log(`${agent.label}: hooks installed in ${file}`);
  for (const hook of installedHooks(next)) console.log(`  ${hook.event.padEnd(19)} ${hook.matcher}`);
}

const NEXT_STEPS = {
  claude: 'Claude Code: restart running sessions to pick the hooks up.',
  codex: 'Codex: open /hooks in Codex once and trust the herdr-db hooks (again whenever the hook command changes), then restart sessions.',
};

try {
  const agents = requestedAgents(process.argv.slice(2));
  for (const id of agents) install(id);
  console.log('');
  for (const id of agents) console.log(NEXT_STEPS[id]);
} catch (error) {
  console.error(`Failed to install herdr-db hooks: ${error.message}`);
  process.exit(1);
}
