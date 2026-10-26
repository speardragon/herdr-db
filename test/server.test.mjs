import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { validateConfig } from '../src/config.mjs';
import { buildEvent } from '../src/normalize.mjs';
import { createViewerServer } from '../src/server/app.mjs';
import { writeEvent } from '../src/store.mjs';
import { fixture, tempHome } from './helpers.mjs';

function request(port, pathname, { method = 'GET', host = `127.0.0.1:${port}` } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers: { host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] }));
    });
    req.on('error', reject);
    req.end();
  });
}

function nextSseEvent(port, type) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/stream', headers: { host: `127.0.0.1:${port}` } }, (res) => {
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        const match = [...buffer.matchAll(/event: (\w+)\ndata: (.*)\n\n/g)].find((m) => m[1] === type);
        if (match) {
          req.destroy();
          resolve({ type: match[1], data: JSON.parse(match[2]) });
        }
      });
    });
    req.on('error', (error) => (error.code === 'ECONNRESET' ? undefined : reject(error)));
  });
}

async function startServer(t) {
  const { home, paths, cleanup } = tempHome();
  const uiDir = path.join(home, 'ui');
  fs.mkdirSync(path.join(uiDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(uiDir, 'index.html'), '<!doctype html><title>Herdr DB</title>');
  fs.writeFileSync(path.join(uiDir, 'assets', 'app.js'), 'console.info(1)');

  const existing = buildEvent(fixture('find'), { env: { HERDR_WORKSPACE_ID: 'w1' }, now: Date.now() - 1000 });
  writeEvent(paths.events, existing);

  const server = createViewerServer({
    paths,
    config: validateConfig({}),
    uiDir,
    workspaceLabels: async () => new Map([['w1', 'shop-api']]),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.close();
    cleanup();
  });
  return { port: server.address().port, paths, existing };
}

test('serves health, event list with herdr labels, and single events', async (t) => {
  const { port, existing } = await startServer(t);
  const health = JSON.parse((await request(port, '/api/health')).body);
  assert.equal(health.app, 'herdr-db');

  const list = JSON.parse((await request(port, '/api/events')).body);
  assert.equal(list.events.length, 1);
  assert.equal(list.events[0].herdr.workspaceLabel, 'shop-api');

  const single = JSON.parse((await request(port, `/api/events/${existing.id}`)).body);
  assert.equal(single.result.documents.length, 2);
  assert.equal((await request(port, '/api/events/nope-00')).status, 404);
});

test('rejects foreign Host headers', async (t) => {
  const { port } = await startServer(t);
  assert.equal((await request(port, '/api/events', { host: 'evil.example:80' })).status, 403);
});

test('serves the UI with an index fallback', async (t) => {
  const { port } = await startServer(t);
  const index = await request(port, '/some/route');
  assert.match(index.body, /Herdr DB/);
  const asset = await request(port, '/assets/app.js');
  assert.match(asset.type, /javascript/);
  const traversal = await request(port, '/../../package.json');
  assert.match(traversal.body, /Herdr DB/);
});

test('streams newly written events and clears the store', async (t) => {
  const { port, paths } = await startServer(t);
  const hello = await nextSseEvent(port, 'hello');
  assert.match(hello.data.boot, /^\d+-\d+$/);
  const pending = nextSseEvent(port, 'added');
  await new Promise((resolve) => setTimeout(resolve, 100));
  const fresh = buildEvent(fixture('update'), { env: {} });
  writeEvent(paths.events, fresh);
  const sse = await pending;
  assert.equal(sse.type, 'added');
  assert.equal(sse.data.summary.id, fresh.id);
  assert.equal(sse.data.reveal, true);

  const cleared = JSON.parse((await request(port, '/api/events', { method: 'DELETE' })).body);
  assert.equal(cleared.removed, 2);
});
