import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathsFor, ensureDirs, validateConfig } from '../src/config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(here, 'fixtures', `${name}.json`), 'utf8'));
}

export function tempHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'herdr-db-test-'));
  const paths = pathsFor(home);
  ensureDirs(paths);
  return { home, paths, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

export function testContext(paths, overrides = {}) {
  const launched = [];
  return {
    launched,
    ctx: {
      env: {},
      paths,
      config: validateConfig({ port: 1 }),
      now: () => Date.UTC(2026, 9, 26, 5, 0, 0),
      capture: {
        before: async () => ({ documents: [], truncated: false, matched: 0 }),
        after: async () => [],
      },
      herdrSession: async () => null,
      launch: async (event) => {
        launched.push(event.id);
      },
      ...overrides,
    },
  };
}
