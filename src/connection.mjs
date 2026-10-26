import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { codexServerConfigs } from './codex-config.mjs';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// Claude Code expands ${VAR} and ${VAR:-default} in MCP configs; mirror that for our own lookup.
export function expandEnvRefs(value, env) {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, fallback) => env[name] ?? fallback ?? '');
}

function argValue(args, flag) {
  if (!Array.isArray(args)) return null;
  for (let i = 0; i < args.length; i += 1) {
    const arg = String(args[i]);
    if (arg === flag && i + 1 < args.length) return String(args[i + 1]);
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return null;
}

export function connectionStringFromServer(serverConfig, env) {
  if (!serverConfig || typeof serverConfig !== 'object') return null;
  const raw =
    serverConfig.env?.MDB_MCP_CONNECTION_STRING ??
    argValue(serverConfig.args, '--connectionString') ??
    // A positional connection string is also accepted by mongodb-mcp-server.
    (Array.isArray(serverConfig.args) ? serverConfig.args.find((arg) => /^mongodb(\+srv)?:\/\//.test(String(arg))) : null);
  return raw ? expandEnvRefs(String(raw), env) : null;
}

function ancestors(dir) {
  const list = [];
  let current = path.resolve(dir);
  for (;;) {
    list.push(current);
    const parent = path.dirname(current);
    if (parent === current) return list;
    current = parent;
  }
}

/** MCP server definitions visible to a Claude Code session in `cwd`, most specific first. */
export function candidateServerConfigs(serverName, { cwd, home = os.homedir(), read = readJson }) {
  const candidates = [];
  const claudeJson = read(path.join(home, '.claude.json'));

  for (const dir of cwd ? ancestors(cwd) : []) {
    const projectScoped = claudeJson?.projects?.[dir]?.mcpServers?.[serverName];
    if (projectScoped) candidates.push(projectScoped);
    const mcpJson = read(path.join(dir, '.mcp.json'));
    if (mcpJson?.mcpServers?.[serverName]) candidates.push(mcpJson.mcpServers[serverName]);
  }
  if (claudeJson?.mcpServers?.[serverName]) candidates.push(claudeJson.mcpServers[serverName]);
  return candidates;
}

function serverConfigs(agent, serverName, { cwd, env, home, read }) {
  if (agent === 'codex') return codexServerConfigs(serverName, { cwd, env, home }).map((entry) => entry.config);
  return candidateServerConfigs(serverName, { cwd, home, read });
}

/** Codex hands us a sanitized server name (`shop_db`); map it back to its config key when we can. */
export function resolveServerName(agent, serverName, { cwd, env = process.env, home } = {}) {
  if (agent !== 'codex') return serverName;
  return codexServerConfigs(serverName, { cwd, env, home })[0]?.name ?? serverName;
}

export function resolveConnectionString(serverName, { agent = 'claude', cwd, env = process.env, home, read } = {}) {
  const override = env[`HERDR_DB_URI_${serverName.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`];
  if (override) return override;
  for (const config of serverConfigs(agent, serverName, { cwd, env, home, read })) {
    const uri = connectionStringFromServer(config, env);
    if (uri) return uri;
  }
  // No guessing: a snapshot from the wrong cluster would be worse than none.
  return null;
}
