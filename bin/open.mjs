#!/usr/bin/env node
// Starts the viewer server if needed and brings the viewer to the front.
//   --settings  open the settings screen
import http from 'node:http';
import { ensureDirs, loadConfig, pathsFor, resolveHome } from '../src/config.mjs';
import { effectiveViewer, ensureServer, openViewer, serverStatus, viewerUrl, waitForServer } from '../src/launcher.mjs';

const view = process.argv.includes('--settings') ? 'settings' : null;

function postNavigate(config, target) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ view: target });
    const req = http.request(
      `${viewerUrl(config)}api/navigate`,
      { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on('error', () => resolve(false));
    req.end(body);
  });
}

async function waitForViewer(config, mode, attempts = 30) {
  for (let i = 0; i < attempts; i += 1) {
    const status = await serverStatus(config);
    if ((mode === 'browser' ? status.browser : status.clients - status.browser) > 0) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

const paths = pathsFor(resolveHome());
ensureDirs(paths);
const config = loadConfig(paths);
await ensureServer(config, paths);
if (!(await waitForServer(config))) {
  console.error(`herdr-db server did not start; see ${paths.serverLog}`);
  process.exit(1);
}

const mode = effectiveViewer(config);
const { browser } = await serverStatus(config);
const target = openViewer(config, { background: false, clients: browser, hash: view ?? '' });
// A viewer that was already open (or the app, which always loads "/") is told where to go over SSE.
if (view && (await waitForViewer(config, mode))) await postNavigate(config, view);
console.log(`herdr-db viewer: ${viewerUrl(config)} (${target})`);
