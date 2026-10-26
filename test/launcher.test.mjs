import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { validateConfig } from '../src/config.mjs';
import { isServerUp, openViewer, serverStatus, shouldOpen, viewerUrl, waitForServer } from '../src/launcher.mjs';
import { createHerdrLabels } from '../src/server/herdr-labels.mjs';

function listen(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('shouldOpen follows the autoOpen mode', () => {
  const mode = (autoOpen) => validateConfig({ autoOpen });
  assert.equal(shouldOpen(mode('always'), 'read'), true);
  assert.equal(shouldOpen(mode('writes'), 'read'), false);
  assert.equal(shouldOpen(mode('writes'), 'write'), true);
  assert.equal(shouldOpen(mode('writes'), 'admin'), true);
  assert.equal(shouldOpen(mode('never'), 'write'), false);
  assert.equal(validateConfig({ autoOpen: 'sometimes', port: -1 }).autoOpen, 'always');
});

test('serverStatus recognises only a herdr-db server', async (t) => {
  const ours = await listen((_req, res) => res.end(JSON.stringify({ app: 'herdr-db', clients: 2 })));
  const other = await listen((_req, res) => res.end('<html>'));
  t.after(() => {
    ours.close();
    other.close();
  });
  const config = (server) => validateConfig({ port: server.address().port });

  assert.deepEqual(await serverStatus(config(ours)), { up: true, clients: 2, browser: 2 });
  assert.deepEqual(await serverStatus(config(other)), { up: false, clients: 0, browser: 0 });
  assert.equal(await isServerUp(config(ours)), true);
  assert.equal(await waitForServer(config(ours), 1), true);
  assert.equal(viewerUrl(config(ours)), `http://127.0.0.1:${ours.address().port}/`);
});

test('serverStatus reports a closed port as down', async () => {
  const server = await listen(() => {});
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  assert.deepEqual(await serverStatus(validateConfig({ port })), { up: false, clients: 0, browser: 0 });
  assert.equal(await waitForServer(validateConfig({ port }), 1), false);
});

test('openViewer does not open another browser tab while a viewer is connected', () => {
  const config = validateConfig({ appPath: '/nonexistent/Herdr DB.app' });
  assert.equal(openViewer(config, { clients: 1 }), 'connected');
});

test('herdr workspace labels are cached', async () => {
  let calls = 0;
  const labels = createHerdrLabels({
    env: { HERDR_BIN_PATH: '/bin/herdr' },
    run: async (bin, args) => {
      calls += 1;
      assert.equal(bin, '/bin/herdr');
      assert.deepEqual(args, ['workspace', 'list']);
      return { result: { workspaces: [{ workspace_id: 'w1', label: 'api' }] } };
    },
  });
  assert.equal((await labels()).get('w1'), 'api');
  assert.equal((await labels()).get('w1'), 'api');
  assert.equal(calls, 1);

  const broken = createHerdrLabels({ run: async () => null });
  assert.equal((await broken()).size, 0);
});
