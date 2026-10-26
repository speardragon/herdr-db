import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'smol-toml';
import { codexHome } from './agents.mjs';

function readToml(file) {
  try {
    return parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Codex replaces every character outside [A-Za-z0-9_] with `_` in model-visible tool names. */
export function sanitizeServerName(name) {
  return String(name).replace(/[^A-Za-z0-9_]/g, '_') || '_';
}

// Project layers live in `.codex/` between cwd and the filesystem root; the home directory's
// `.codex/` is the user layer, which is read separately.
function projectDirs(cwd, home) {
  if (!cwd) return [];
  const dirs = [];
  let current = path.resolve(cwd);
  for (;;) {
    if (current === path.resolve(home)) return dirs;
    dirs.push(current);
    const parent = path.dirname(current);
    if (parent === current) return dirs;
    current = parent;
  }
}

function matchingServers(config, sanitized) {
  const servers = config?.mcp_servers;
  if (!servers || typeof servers !== 'object') return [];
  return Object.entries(servers)
    .filter(([name]) => name === sanitized || sanitizeServerName(name) === sanitized)
    .map(([name, server]) => ({ name, config: server }));
}

/** `[mcp_servers.*]` entries that a Codex session in `cwd` could have called as `sanitized`, most specific first. */
export function codexServerConfigs(sanitized, { cwd, env = process.env, home = os.homedir(), read = readToml } = {}) {
  const files = [
    ...projectDirs(cwd, home).map((dir) => path.join(dir, '.codex', 'config.toml')),
    path.join(codexHome(env), 'config.toml'),
  ];
  return [...new Set(files)].flatMap((file) => matchingServers(read(file), sanitized));
}
