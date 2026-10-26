import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const AUTO_OPEN_MODES = new Set(['always', 'writes', 'never']);
const VIEWER_MODES = new Set(['app', 'browser']);

// Fields the viewer's settings screen may change. The port is fixed while the server runs.
export const EDITABLE_KEYS = Object.freeze(['viewer', 'autoOpen', 'snapshotLimit', 'maxEvents', 'maxAgeDays']);

export const DEFAULT_CONFIG = Object.freeze({
  port: 47917,
  // Where the viewer opens: the native window, or a browser tab on the local port.
  viewer: 'app',
  // When the viewer window pops up: on every captured call, only on writes, or never.
  autoOpen: 'always',
  // Max documents captured before an update-many / delete-many runs.
  snapshotLimit: 50,
  snapshotTimeoutMs: 4000,
  maxEvents: 500,
  maxAgeDays: 14,
  appPath: path.join(PLUGIN_ROOT, 'mac', 'build', 'Herdr DB.app'),
});

export function resolveHome(env = process.env) {
  return env.HERDR_DB_HOME || path.join(os.homedir(), '.herdr-db');
}

export function pathsFor(home) {
  return Object.freeze({
    home,
    events: path.join(home, 'events'),
    pending: path.join(home, 'pending'),
    config: path.join(home, 'config.json'),
    hookLog: path.join(home, 'hook.log'),
    serverLog: path.join(home, 'server.log'),
  });
}

export function ensureDirs(paths) {
  // Captured documents can contain production data: keep them private to the user.
  for (const dir of [paths.home, paths.events, paths.pending]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}

function pickPositiveInt(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function validateConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  return Object.freeze({
    port: pickPositiveInt(input.port, DEFAULT_CONFIG.port),
    viewer: VIEWER_MODES.has(input.viewer) ? input.viewer : DEFAULT_CONFIG.viewer,
    autoOpen: AUTO_OPEN_MODES.has(input.autoOpen) ? input.autoOpen : DEFAULT_CONFIG.autoOpen,
    snapshotLimit: pickPositiveInt(input.snapshotLimit, DEFAULT_CONFIG.snapshotLimit),
    snapshotTimeoutMs: pickPositiveInt(input.snapshotTimeoutMs, DEFAULT_CONFIG.snapshotTimeoutMs),
    maxEvents: pickPositiveInt(input.maxEvents, DEFAULT_CONFIG.maxEvents),
    maxAgeDays: pickPositiveInt(input.maxAgeDays, DEFAULT_CONFIG.maxAgeDays),
    appPath: typeof input.appPath === 'string' && input.appPath ? input.appPath : DEFAULT_CONFIG.appPath,
  });
}

export function loadConfig(paths) {
  try {
    return validateConfig(JSON.parse(fs.readFileSync(paths.config, 'utf8')));
  } catch {
    return validateConfig({});
  }
}

function readRawConfig(paths) {
  try {
    const raw = JSON.parse(fs.readFileSync(paths.config, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/** Applies a partial update from the settings screen; unknown or invalid values are rejected. */
export function updateConfig(paths, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('settings must be an object');
  const unknown = Object.keys(patch).filter((key) => !EDITABLE_KEYS.includes(key));
  if (unknown.length) throw new Error(`not editable: ${unknown.join(', ')}`);

  const current = readRawConfig(paths);
  const next = validateConfig({ ...current, ...patch });
  const rejected = Object.keys(patch).filter((key) => next[key] !== patch[key]);
  if (rejected.length) throw new Error(`invalid value for: ${rejected.join(', ')}`);

  const tmp = `${paths.config}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, paths.config);
  return next;
}

export function appendLog(file, message) {
  try {
    fs.appendFileSync(file, `${new Date().toISOString()} ${message}\n`, { mode: 0o600 });
  } catch {
    // Logging must never break the hook.
  }
}
