import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function claudeHome(env = process.env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

export function codexHome(env = process.env) {
  return env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

/**
 * Coding agents whose hooks we install. Claude Code reports failed calls as PostToolUseFailure;
 * Codex has no such event and sends failures as PostToolUse with `isError: true`.
 */
export const AGENTS = Object.freeze({
  claude: Object.freeze({
    id: 'claude',
    label: 'Claude Code',
    hooksFile: (env = process.env) => path.join(claudeHome(env), 'settings.json'),
    configDir: claudeHome,
    events: Object.freeze({ PreToolUse: 15, PostToolUse: 15, PostToolUseFailure: 10 }),
  }),
  codex: Object.freeze({
    id: 'codex',
    label: 'Codex',
    hooksFile: (env = process.env) => path.join(codexHome(env), 'hooks.json'),
    configDir: codexHome,
    events: Object.freeze({ PreToolUse: 15, PostToolUse: 15 }),
  }),
});

export const AGENT_IDS = Object.freeze(Object.keys(AGENTS));

export function isAgent(id) {
  return Object.hasOwn(AGENTS, id);
}

/** The installed hook command sets HERDR_DB_AGENT; hooks installed before Codex support carry none. */
export function agentFromEnv(env = process.env) {
  return isAgent(env.HERDR_DB_AGENT) ? env.HERDR_DB_AGENT : 'claude';
}

/** Agents whose config directory exists on this machine. */
export function detectedAgents(env = process.env) {
  return AGENT_IDS.filter((id) => fs.existsSync(AGENTS[id].configDir(env)));
}
