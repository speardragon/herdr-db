#!/usr/bin/env node
// Removes only the herdr-db entries from every agent's hook settings.
import fs from 'node:fs';
import { AGENTS, AGENT_IDS } from '../src/agents.mjs';
import { installedHooks, readSettings, removeHooks, writeSettings } from '../src/settings.mjs';

let failed = false;
for (const id of AGENT_IDS) {
  const { label, hooksFile } = AGENTS[id];
  const file = hooksFile();
  if (!fs.existsSync(file)) continue;
  try {
    const current = readSettings(file);
    const count = installedHooks(current).length;
    if (count === 0) {
      console.log(`${label}: herdr-db hooks are not installed.`);
      continue;
    }
    writeSettings(file, removeHooks(current));
    console.log(`${label}: removed ${count} herdr-db hook entries from ${file}`);
  } catch (error) {
    failed = true;
    console.error(`${label}: failed to update ${file}: ${error.message}`);
  }
}
process.exit(failed ? 1 : 0);
