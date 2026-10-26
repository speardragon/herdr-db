import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { loadConfig, updateConfig, validateConfig } from '../src/config.mjs';
import { createViewerServer } from '../src/server/app.mjs';
import { tempHome } from './helpers.mjs';

function call(port, pathname, { method = 'GET', body, type = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { host: `127.0.0.1:${port}`, ...(body !== undefined ? { 'content-type': type } : {}) };
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
      });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

function collectSse(port, client) {
  const frames = [];
  const req = http.get({ host: '127.0.0.1', port, path: `/api/stream?client=${client}`, headers: { host: `127.0.0.1:${port}` } }, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      for (const m of chunk.matchAll(/event: (\w+)\ndata: (.*)\n\n/g)) frames.push({ type: m[1], data: JSON.parse(m[2]) });
    });
  });
  req.on('error', () => {});
  return { frames, close: () => req.destroy() };
}

const tick = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

async function start(t, appPath = '/nonexistent/Herdr DB.app') {
  const { paths, cleanup } = tempHome();
  const launches = [];
  const server = createViewerServer({
    paths,
    config: validateConfig({ appPath: appPath === 'home' ? paths.home : appPath }),
    uiDir: paths.home,
    workspaceLabels: async () => new Map(),
    launch: (config, options) => launches.push({ viewer: config.viewer, ...options }),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.close();
    cleanup();
  });
  return { port: server.address().port, paths, launches };
}

test('updateConfig validates and persists only editable keys', (t) => {
  const { paths, cleanup } = tempHome();
  t.after(cleanup);
  fs.writeFileSync(paths.config, JSON.stringify({ port: 5000, custom: 'kept' }));

  const next = updateConfig(paths, { viewer: 'browser', snapshotLimit: 20 });
  assert.equal(next.viewer, 'browser');
  assert.equal(loadConfig(paths).snapshotLimit, 20);
  assert.equal(JSON.parse(fs.readFileSync(paths.config, 'utf8')).custom, 'kept');
  assert.equal(fs.statSync(paths.config).mode & 0o777, 0o600);

  assert.throws(() => updateConfig(paths, { port: 1 }), /not editable: port/);
  assert.throws(() => updateConfig(paths, { viewer: 'tui' }), /invalid value for: viewer/);
  assert.throws(() => updateConfig(paths, { maxEvents: -3 }), /invalid value for: maxEvents/);
  assert.throws(() => updateConfig(paths, []), /must be an object/);
  assert.equal(loadConfig(paths).viewer, 'browser', 'rejected updates leave the file alone');
});

test('GET /api/settings reports settings and status', async (t) => {
  const { port } = await start(t);
  const { status, body } = await call(port, '/api/settings');
  assert.equal(status, 200);
  assert.equal(body.settings.viewer, 'app');
  assert.equal(body.status.appBuilt, false);
  assert.equal(body.status.effectiveViewer, 'browser', 'falls back when the app is not built');
  assert.deepEqual(body.status.viewers, { app: 0, browser: 0 });
  assert.equal('port' in body.settings, false);
});

test('PUT /api/settings saves and broadcasts', async (t) => {
  const { port, launches } = await start(t);
  const app = collectSse(port, 'app');
  const tab = collectSse(port, 'browser');
  t.after(() => {
    app.close();
    tab.close();
  });
  await tick();

  const health = await call(port, '/api/health');
  assert.equal(health.body.app, 'herdr-db');
  assert.deepEqual(health.body.viewers, { app: 1, browser: 1 });
  assert.equal(health.body.browser, 1);

  const saved = await call(port, '/api/settings', { method: 'PUT', body: { autoOpen: 'writes' } });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.settings.autoOpen, 'writes');
  await tick();
  assert.deepEqual(app.frames.find((f) => f.type === 'config')?.data.settings.autoOpen, 'writes');
  assert.equal(launches.length, 0, 'effective viewer did not change');

  const bad = await call(port, '/api/settings', { method: 'PUT', body: { viewer: 'tui' } });
  assert.equal(bad.status, 400);
  const notJson = await call(port, '/api/settings', { method: 'PUT', body: { viewer: 'browser' }, type: 'text/plain' });
  assert.equal(notJson.status, 400);
});

test('switching from browser to an unavailable app keeps the browser and does not relaunch', async (t) => {
  const { port, launches } = await start(t);
  await call(port, '/api/settings', { method: 'PUT', body: { viewer: 'browser' } });
  await call(port, '/api/settings', { method: 'PUT', body: { viewer: 'app' } });
  assert.equal(launches.length, 0);
});

test('POST /api/navigate broadcasts a known view only', async (t) => {
  const { port } = await start(t);
  const tab = collectSse(port, 'browser');
  t.after(() => tab.close());
  await tick();
  assert.equal((await call(port, '/api/navigate', { method: 'POST', body: { view: 'settings' } })).status, 200);
  assert.equal((await call(port, '/api/navigate', { method: 'POST', body: { view: 'javascript:alert(1)' } })).status, 400);
  await tick();
  assert.deepEqual(tab.frames.filter((f) => f.type === 'navigate').map((f) => f.data.view), ['settings']);
});

test('switching between a built app and the browser reopens in the new mode', { skip: process.platform !== 'darwin' }, async (t) => {
  const { port, launches } = await start(t, 'home');
  await call(port, '/api/settings', { method: 'PUT', body: { viewer: 'browser' } });
  await call(port, '/api/settings', { method: 'PUT', body: { viewer: 'app' } });
  assert.deepEqual(
    launches.map((l) => [l.viewer, l.background]),
    [
      ['browser', false],
      ['app', false],
    ],
  );
});
