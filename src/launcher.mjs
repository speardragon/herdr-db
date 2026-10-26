import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PLUGIN_ROOT } from './config.mjs';

export function viewerUrl(config) {
  return `http://127.0.0.1:${config.port}/`;
}

/** `{ up, clients, browser }` — open viewers in total, and how many of them are browser tabs. */
export function serverStatus(config, timeoutMs = 400) {
  return new Promise((resolve) => {
    const req = http.get(`${viewerUrl(config)}api/health`, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({
            up: res.statusCode === 200 && parsed.app === 'herdr-db',
            clients: parsed.clients ?? 0,
            browser: parsed.browser ?? parsed.clients ?? 0,
          });
        } catch {
          resolve({ up: false, clients: 0, browser: 0 });
        }
      });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve({ up: false, clients: 0, browser: 0 }));
  });
}

export async function isServerUp(config, timeoutMs) {
  return (await serverStatus(config, timeoutMs)).up;
}

function detached(command, args, options = {}) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', ...options });
  child.on('error', () => {});
  child.unref();
}

export async function ensureServer(config, paths) {
  if (await isServerUp(config)) return false;
  const log = fs.openSync(paths.serverLog, 'a', 0o600);
  detached(process.execPath, [path.join(PLUGIN_ROOT, 'bin', 'server.mjs')], {
    stdio: ['ignore', log, log],
    env: { ...process.env, HERDR_DB_HOME: paths.home },
  });
  fs.closeSync(log);
  return true;
}

export async function waitForServer(config, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isServerUp(config)) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

export function hasNativeApp(config) {
  return process.platform === 'darwin' && fs.existsSync(config.appPath);
}

/** The mode that will actually be used: the native window needs macOS and a built app. */
export function effectiveViewer(config) {
  return config.viewer === 'app' && hasNativeApp(config) ? 'app' : 'browser';
}

/**
 * Opens the viewer in the configured mode.
 * App: `open -a` on a running app is a no-op, and `-g` keeps the terminal focused; the window
 * raises itself (without taking focus) when the new event arrives.
 * Browser: a tab would be duplicated on every call, so one is only opened when no viewer is connected.
 */
export function openViewer(config, { background = true, clients = 0, hash = '' } = {}) {
  const bg = background ? ['-g'] : [];
  if (effectiveViewer(config) === 'app') {
    detached('open', [...bg, '-a', config.appPath, '--args', `--port=${config.port}`]);
    return 'app';
  }
  if (clients > 0) return 'connected';
  const url = `${viewerUrl(config)}${hash ? `#${hash}` : ''}`;
  detached(process.platform === 'darwin' ? 'open' : 'xdg-open', [...(process.platform === 'darwin' ? bg : []), url]);
  return 'browser';
}

export function shouldOpen(config, kind) {
  if (config.autoOpen === 'never') return false;
  if (config.autoOpen === 'writes') return kind === 'write' || kind === 'admin';
  return true;
}
