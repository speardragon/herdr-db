import test from 'node:test';
import assert from 'node:assert/strict';
import { herdrSessionLabels } from '../src/herdr-session.mjs';
import { handleHookPayload } from '../src/hook.mjs';
import { readEvent } from '../src/store.mjs';
import { fixture, tempHome, testContext } from './helpers.mjs';

const IDS = { workspaceId: 'w1', tabId: 'w1:t1', paneId: 'w1:p1' };

const RESPONSES = {
  'workspace get w1': { result: { workspace: { workspace_id: 'w1', label: 'shop' } } },
  'tab get w1:t1': { result: { tab: { tab_id: 'w1:t1', label: 'billing fix' } } },
  'pane get w1:p1': { result: { pane: { pane_id: 'w1:p1', terminal_title: '✳ Refund report', terminal_title_stripped: 'Refund report' } } },
};

const fakeRun = (responses) => async (_bin, args) => responses[args.join(' ')] ?? null;

test('herdrSessionLabels names the workspace, tab and pane a call came from', async () => {
  const calls = [];
  const run = async (bin, args) => {
    calls.push(bin);
    return fakeRun(RESPONSES)(bin, args);
  };
  const labels = await herdrSessionLabels(IDS, { env: { HERDR_BIN_PATH: '/opt/herdr' }, run });
  assert.deepEqual(labels, { workspaceLabel: 'shop', tabLabel: 'billing fix', paneTitle: 'Refund report' });
  assert.deepEqual(calls, ['/opt/herdr', '/opt/herdr', '/opt/herdr']);
});

test('herdrSessionLabels keeps what it could resolve and never throws', async () => {
  const partial = await herdrSessionLabels(IDS, { env: {}, run: fakeRun({ 'tab get w1:t1': RESPONSES['tab get w1:t1'] }) });
  assert.deepEqual(partial, { workspaceLabel: null, tabLabel: 'billing fix', paneTitle: null });

  const failing = await herdrSessionLabels(IDS, {
    env: {},
    run: async () => {
      throw new Error('socket gone');
    },
  });
  assert.deepEqual(failing, { workspaceLabel: null, tabLabel: null, paneTitle: null });
});

test('herdrSessionLabels skips herdr entirely outside a herdr pane', async () => {
  let called = false;
  const run = async () => {
    called = true;
    return null;
  };
  assert.equal(await herdrSessionLabels(null, { env: {}, run }), null);
  assert.deepEqual(await herdrSessionLabels({ workspaceId: null, tabId: null, paneId: null }, { env: {}, run }), {
    workspaceLabel: null,
    tabLabel: null,
    paneTitle: null,
  });
  assert.equal(called, false);
});

test('the hook stores the herdr names at the moment of the call', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const seen = [];
  const { ctx } = testContext(paths, {
    env: { HERDR_WORKSPACE_ID: 'w1', HERDR_TAB_ID: 'w1:t1', HERDR_PANE_ID: 'w1:p1' },
    herdrSession: async (ids) => {
      seen.push(ids);
      return { workspaceLabel: 'shop', tabLabel: 'billing fix', paneTitle: 'Refund report' };
    },
  });
  const outcome = await handleHookPayload(fixture('find'), ctx);
  const event = readEvent(paths.events, outcome.eventId);
  assert.deepEqual(seen, [IDS]);
  assert.deepEqual(event.context.herdr, { ...IDS, workspaceLabel: 'shop', tabLabel: 'billing fix', paneTitle: 'Refund report' });
});

test('the hook leaves herdr out when the agent runs outside herdr', async (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  const { ctx } = testContext(paths);
  const outcome = await handleHookPayload(fixture('find'), ctx);
  assert.equal(readEvent(paths.events, outcome.eventId).context.herdr, null);
});
