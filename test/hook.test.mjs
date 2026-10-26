import test from 'node:test';
import assert from 'node:assert/strict';
import { handleHookPayload, runHook } from '../src/hook.mjs';
import { readEvent } from '../src/store.mjs';
import { fixture, tempHome, testContext } from './helpers.mjs';

const OVERRIDE_ENV = { HERDR_DB_URI_LOCAL_MONGODB: 'mongodb://fake' };

function preOf(payload) {
  const { tool_response: _response, duration_ms: _duration, ...rest } = payload;
  return { ...rest, hook_event_name: 'PreToolUse' };
}

test('read calls become events and launch the viewer', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const { ctx, launched } = testContext(paths);
  const outcome = await handleHookPayload(fixture('find'), ctx);
  assert.equal(outcome.phase, 'post');
  assert.deepEqual(launched, [outcome.eventId]);
  const event = readEvent(paths.events, outcome.eventId);
  assert.equal(event.result.documents.length, 2);
  assert.equal(event.snapshot, null);
});

test('autoOpen=writes stays quiet for reads', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const { ctx, launched } = testContext(paths);
  await handleHookPayload(fixture('find'), { ...ctx, config: { ...ctx.config, autoOpen: 'writes' } });
  assert.deepEqual(launched, []);
});

test('update-many is snapshotted before and re-read by _id after', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const before = [{ _id: { $oid: '6adedc58761ef473c665d0fc' }, name: 'Lee', age: { $numberInt: '25' } }];
  const after = [{ _id: { $oid: '6adedc58761ef473c665d0fc' }, name: 'Lee', age: { $numberInt: '26' } }];
  const calls = [];
  const { ctx } = testContext(paths, {
    env: OVERRIDE_ENV,
    capture: {
      before: async (args) => {
        calls.push(['before', args]);
        return { documents: before, truncated: false, matched: 1 };
      },
      after: async (args) => {
        calls.push(['after', args]);
        return after;
      },
    },
  });

  const payload = fixture('update');
  assert.deepEqual(await handleHookPayload(preOf(payload), ctx), { phase: 'pre', snapshot: 'captured' });
  const outcome = await handleHookPayload(payload, ctx);
  const event = readEvent(paths.events, outcome.eventId);

  assert.deepEqual(event.snapshot, { before, after, truncated: false, matched: 1 });
  assert.equal(calls[0][1].uri, 'mongodb://fake');
  assert.deepEqual(calls[0][1].filter, { name: 'Lee' });
  assert.deepEqual(calls[1][1].ids, [{ $oid: '6adedc58761ef473c665d0fc' }]);
});

test('snapshot problems are recorded instead of failing the hook', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const payload = fixture('update');

  const noUri = testContext(paths).ctx;
  assert.deepEqual(await handleHookPayload(preOf(payload), noUri), { phase: 'pre', snapshot: 'unavailable' });
  const first = await handleHookPayload(payload, noUri);
  assert.deepEqual(readEvent(paths.events, first.eventId).snapshot, { error: 'connection-string-not-found' });

  const failing = testContext(paths, {
    env: OVERRIDE_ENV,
    capture: {
      before: async () => {
        throw new Error('timeout');
      },
      after: async () => [],
    },
  }).ctx;
  assert.equal((await handleHookPayload(preOf(payload), failing)).snapshot, 'failed');
  const second = await handleHookPayload(payload, failing);
  assert.deepEqual(readEvent(paths.events, second.eventId).snapshot, { error: 'before: timeout' });

  const third = await handleHookPayload({ ...payload, tool_use_id: 'toolu_unseen' }, failing);
  assert.deepEqual(readEvent(paths.events, third.eventId).snapshot, { error: 'no-before-snapshot' });
});

test('runtime connections cannot be snapshotted', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const { ctx } = testContext(paths, { env: OVERRIDE_ENV });
  const payload = { ...fixture('update'), tool_input: { ...fixture('update').tool_input, connectionId: 'abc' } };
  await handleHookPayload(preOf(payload), ctx);
  const outcome = await handleHookPayload(payload, ctx);
  assert.deepEqual(readEvent(paths.events, outcome.eventId).snapshot, { error: 'runtime-connection' });
});

test('unrelated tools and hook events are skipped', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const { ctx } = testContext(paths);
  assert.deepEqual(await handleHookPayload({ tool_name: 'Bash', hook_event_name: 'PostToolUse' }, ctx), { skipped: true });
  assert.deepEqual(await handleHookPayload(preOf(fixture('find')), ctx), { phase: 'pre', snapshot: null });
  assert.deepEqual(await handleHookPayload({ ...fixture('find'), hook_event_name: 'Stop' }, ctx), { skipped: true });
});

test('runHook swallows malformed input', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const { ctx } = testContext(paths);
  const outcome = await runHook('{not json', ctx);
  assert.ok(outcome.error);
});
