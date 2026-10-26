#!/usr/bin/env node
// Prints hook installation (per agent), server, app and event-store status.
import fs from 'node:fs';
import { loadConfig, pathsFor, resolveHome } from '../src/config.mjs';
import { effectiveViewer, serverStatus, viewerUrl } from '../src/launcher.mjs';
import { hookStatus } from '../src/settings.mjs';
import { listEventIds } from '../src/store.mjs';

const paths = pathsFor(resolveHome());
const config = loadConfig(paths);
const status = await serverStatus(config);

for (const hooks of Object.values(hookStatus())) {
  const state = hooks.events.length ? hooks.events.join(', ') : hooks.detected ? 'not installed (run install-hooks)' : 'not found on this machine';
  console.log(`${hooks.label.padEnd(12)}: ${state}`);
  // The hook command pins the node binary that installed it (nvm upgrades can remove it).
  if (hooks.nodePathMissing) console.log('              ! the node binary the hooks point to no longer exists: run install-hooks again');
}
console.log(`server      : ${status.up ? `running at ${viewerUrl(config)} (${status.clients} viewer(s))` : 'stopped (starts on the next captured call)'}`);
console.log(`mac app     : ${fs.existsSync(config.appPath) ? config.appPath : 'not built (npm run build:mac) - falls back to the browser'}`);
console.log(`events      : ${listEventIds(paths.events).length} stored in ${paths.events}`);
console.log(`viewer      : ${config.viewer}${effectiveViewer(config) !== config.viewer ? ` (using ${effectiveViewer(config)})` : ''}`);
console.log(`auto open   : ${config.autoOpen} (change in the viewer's settings screen)`);
