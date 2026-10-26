import fs from 'node:fs';
import path from 'node:path';
import { AGENTS } from './agents.mjs';
import { CAPTURED_TOOLS, SNAPSHOT_TOOLS, toolMatcher } from './tools.mjs';

export const HOOK_MARKER = 'HERDR_DB_HOOK=1';

export function claudeSettingsPath(env = process.env) {
  return AGENTS.claude.hooksFile(env);
}

export function hookCommand(nodePath, hookPath, agent = 'claude') {
  const quote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
  return `${HOOK_MARKER} HERDR_DB_AGENT=${agent} ${quote(nodePath)} ${quote(hookPath)}`;
}

export function desiredHooks(command, agent = 'claude') {
  // Only the count-only writes need a PreToolUse snapshot.
  const matcherFor = (event) => toolMatcher(event === 'PreToolUse' ? SNAPSHOT_TOOLS : CAPTURED_TOOLS);
  return Object.fromEntries(
    Object.entries(AGENTS[agent].events).map(([event, timeout]) => [
      event,
      { matcher: matcherFor(event), hooks: [{ type: 'command', command, timeout }] },
    ]),
  );
}

function isOurs(group) {
  return Array.isArray(group?.hooks) && group.hooks.some((hook) => String(hook.command ?? '').includes(HOOK_MARKER));
}

export function removeHooks(settings) {
  const hooks = settings.hooks ?? {};
  const cleaned = Object.fromEntries(
    Object.entries(hooks).map(([event, groups]) => [event, Array.isArray(groups) ? groups.filter((group) => !isOurs(group)) : groups]),
  );
  return { ...settings, hooks: cleaned };
}

/** Idempotent: replaces any previous herdr-db entries, leaves every other hook untouched. */
export function addHooks(settings, command, agent = 'claude') {
  const base = removeHooks(settings);
  const additions = desiredHooks(command, agent);
  const hooks = { ...base.hooks };
  const merged = Object.fromEntries(
    Object.entries(additions).map(([event, group]) => [event, [...(Array.isArray(hooks[event]) ? hooks[event] : []), group]]),
  );
  return { ...base, hooks: { ...hooks, ...merged } };
}

export function installedHooks(settings) {
  return Object.entries(settings.hooks ?? {}).flatMap(([event, groups]) =>
    (Array.isArray(groups) ? groups : []).filter(isOurs).map((group) => ({ event, matcher: group.matcher, command: group.hooks[0]?.command })),
  );
}

function hookNodePath(command) {
  return /HERDR_DB_HOOK=1 (?:HERDR_DB_AGENT=\w+ )?'([^']+)'/.exec(command ?? '')?.[1] ?? null;
}

/** Per-agent installation state, for `bin/status.mjs` and the settings screen. */
export function hookStatus(env = process.env, agents = Object.keys(AGENTS)) {
  return Object.fromEntries(
    agents.map((id) => {
      const agent = AGENTS[id];
      try {
        const hooks = installedHooks(readSettings(agent.hooksFile(env)));
        const nodePath = hookNodePath(hooks[0]?.command);
        return [
          id,
          {
            label: agent.label,
            detected: fs.existsSync(agent.configDir(env)),
            file: agent.hooksFile(env),
            events: hooks.map((hook) => hook.event),
            nodePathMissing: Boolean(nodePath && !fs.existsSync(nodePath)),
          },
        ];
      } catch {
        return [id, { label: agent.label, detected: false, file: agent.hooksFile(env), events: [], nodePathMissing: false, unreadable: true }];
      }
    }),
  );
}

export function readSettings(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeSettings(file, settings) {
  if (fs.existsSync(file)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '');
    fs.copyFileSync(file, `${file}.${stamp}.herdr-db.bak`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.herdr-db.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(settings, null, 2)}\n`);
  fs.renameSync(tmp, file);
}
