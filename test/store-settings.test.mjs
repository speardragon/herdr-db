import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildEvent } from '../src/normalize.mjs';
import { clearEvents, listEventIds, listSummaries, pruneEvents, readEvent, writeEvent } from '../src/store.mjs';
import { addHooks, hookCommand, installedHooks, readSettings, removeHooks, writeSettings } from '../src/settings.mjs';
import { prunePending, savePending, takePending } from '../src/snapshot.mjs';
import { fixture, tempHome } from './helpers.mjs';

test('events are written privately, listed newest first and pruned', (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 9, 26);
  const old = buildEvent(fixture('find'), { env: {}, now: now - 30 * day });
  const mid = buildEvent(fixture('update'), { env: {}, now: now - day });
  const fresh = buildEvent(fixture('aggregate'), { env: {}, now });
  for (const event of [old, mid, fresh]) writeEvent(paths.events, event);

  assert.equal(fs.statSync(path.join(paths.events, `${fresh.id}.json`)).mode & 0o777, 0o600);
  assert.deepEqual(listEventIds(paths.events), [fresh.id, mid.id, old.id]);
  assert.equal(listSummaries(paths.events)[0].tool, 'aggregate');
  assert.equal(readEvent(paths.events, fresh.id).tool, 'aggregate');
  assert.equal(readEvent(paths.events, '../../etc/passwd'), null);

  assert.deepEqual(pruneEvents(paths.events, { maxEvents: 10, maxAgeDays: 14 }, now), [old.id]);
  assert.deepEqual(pruneEvents(paths.events, { maxEvents: 1, maxAgeDays: 14 }, now), [mid.id]);
  assert.equal(clearEvents(paths.events), 1);
  assert.deepEqual(listEventIds(paths.events), []);
});

test('pending snapshots are consumed once and expire', (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  savePending(paths.pending, 'toolu_1', { documents: [{ a: 1 }] });
  assert.deepEqual(takePending(paths.pending, 'toolu_1'), { documents: [{ a: 1 }] });
  assert.equal(takePending(paths.pending, 'toolu_1'), null);

  savePending(paths.pending, 'toolu_2', {});
  prunePending(paths.pending, 1000, Date.now() + 5000);
  assert.equal(takePending(paths.pending, 'toolu_2'), null);
});

test('addHooks is idempotent and keeps unrelated hooks', () => {
  const settings = {
    model: 'opus',
    hooks: { PreToolUse: [{ matcher: 'AskUserQuestion', hooks: [{ type: 'command', command: 'other' }] }] },
  };
  const command = hookCommand('/usr/bin/node', "/p/it's/bin/hook.mjs");
  const once = addHooks(settings, command);
  const twice = addHooks(once, command);
  assert.deepEqual(twice, once);
  assert.equal(once.model, 'opus');
  assert.equal(once.hooks.PreToolUse.length, 2);
  assert.equal(installedHooks(once).length, 3);
  assert.match(command, /'\/p\/it'\\''s\/bin\/hook.mjs'$/);
  assert.equal(settings.hooks.PreToolUse.length, 1, 'input is not mutated');

  const removed = removeHooks(once);
  assert.deepEqual(removed.hooks.PreToolUse, settings.hooks.PreToolUse);
  assert.equal(installedHooks(removed).length, 0);
});

test('writeSettings backs up the previous file', (t) => {
  const { home, cleanup } = tempHome();
  t.after(cleanup);
  const file = path.join(home, 'settings.json');
  writeSettings(file, { a: 1 });
  writeSettings(file, { a: 2 });
  assert.deepEqual(readSettings(file), { a: 2 });
  assert.equal(fs.readdirSync(home).filter((name) => name.endsWith('.herdr-db.bak')).length, 1);
  assert.deepEqual(readSettings(path.join(home, 'missing.json')), {});
});
