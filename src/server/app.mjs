import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { PLUGIN_ROOT } from '../config.mjs';
import { summarize } from '../normalize.mjs';
import { clearEvents, eventIdFromFile, listSummaries, pruneEvents, readEvent } from '../store.mjs';
import { shouldOpen } from '../launcher.mjs';
import { createHerdrLabels } from './herdr-labels.mjs';
import { createSettingsApi } from './settings-api.mjs';
import { serveStatic } from './static.mjs';

const PRUNE_INTERVAL_MS = 10 * 60 * 1000;

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

// The server holds real database documents: refuse anything that is not addressed to loopback
// (protects against DNS-rebinding pages reading the API).
function isAllowedHost(host, port) {
  return [`127.0.0.1:${port}`, `localhost:${port}`].includes(String(host ?? ''));
}

// Names captured by the hook win; events from before that only carry ids, so look the workspace up now.
function withWorkspaceLabel(herdr, labels) {
  if (!herdr?.workspaceId || herdr.workspaceLabel) return herdr;
  return { ...herdr, workspaceLabel: labels.get(herdr.workspaceId) ?? null };
}

function withLabels(summary, labels) {
  return summary.herdr ? { ...summary, herdr: withWorkspaceLabel(summary.herdr, labels) } : summary;
}

export function createViewerServer({
  paths,
  config: initialConfig,
  uiDir = path.join(PLUGIN_ROOT, 'ui', 'dist'),
  workspaceLabels = createHerdrLabels(),
  launch,
}) {
  // Open event streams and whether each comes from the native window or a browser tab.
  const clients = new Map();
  const bootId = `${process.pid}-${Date.now()}`;
  let config = initialConfig;
  let summaries = new Map(listSummaries(paths.events).map((s) => [s.id, s]));

  function broadcast(type, data) {
    const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients.keys()) res.write(frame);
  }

  function clientCounts() {
    const kinds = [...clients.values()];
    return { app: kinds.filter((kind) => kind === 'app').length, browser: kinds.filter((kind) => kind === 'browser').length };
  }

  const settingsApi = createSettingsApi({
    paths,
    getConfig: () => config,
    setConfig: (next) => {
      config = next;
    },
    broadcast,
    clientCounts,
    ...(launch ? { launch } : {}),
  });

  async function onEventFile(name) {
    const id = eventIdFromFile(name);
    if (!id) return;
    const event = readEvent(paths.events, id);
    if (!event) {
      if (summaries.has(id)) {
        summaries = new Map([...summaries].filter(([key]) => key !== id));
        broadcast('removed', { id });
      }
      return;
    }
    if (summaries.has(id)) return;
    const summary = withLabels(summarize(event), await workspaceLabels());
    summaries = new Map([[id, summary], ...summaries]);
    broadcast('added', { summary, reveal: shouldOpen(config, summary.kind) });
  }

  const watcher = fs.watch(paths.events, (_type, name) => {
    if (name) onEventFile(String(name)).catch(() => {});
  });

  function prune() {
    const removed = new Set(pruneEvents(paths.events, config));
    if (removed.size) summaries = new Map([...summaries].filter(([id]) => !removed.has(id)));
  }
  prune();
  const pruneTimer = setInterval(prune, PRUNE_INTERVAL_MS);
  pruneTimer.unref();

  async function handleApi(req, res, url) {
    if (url.pathname === '/api/health') {
      const viewers = clientCounts();
      return sendJson(res, 200, { app: 'herdr-db', clients: clients.size, browser: viewers.browser, viewers, events: summaries.size });
    }
    if (await settingsApi(req, res, url)) return undefined;
    if (url.pathname === '/api/events' && req.method === 'GET') {
      const labels = await workspaceLabels();
      const list = [...summaries.values()].sort((a, b) => (a.id < b.id ? 1 : -1)).map((s) => withLabels(s, labels));
      return sendJson(res, 200, { events: list });
    }
    if (url.pathname === '/api/events' && req.method === 'DELETE') {
      const removed = clearEvents(paths.events);
      summaries = new Map();
      broadcast('cleared', { removed });
      return sendJson(res, 200, { removed });
    }
    const match = /^\/api\/events\/([0-9a-z]+-[0-9a-f]+)$/.exec(url.pathname);
    if (match && req.method === 'GET') {
      const event = readEvent(paths.events, match[1]);
      if (!event) return sendJson(res, 404, { error: 'not found' });
      const herdr = event.context?.herdr;
      if (!herdr) return sendJson(res, 200, event);
      return sendJson(res, 200, { ...event, context: { ...event.context, herdr: withWorkspaceLabel(herdr, await workspaceLabels()) } });
    }
    if (url.pathname === '/api/stream') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 1000\n\n');
      // Lets an open viewer notice a restarted (possibly upgraded) server and reload itself.
      res.write(`event: hello\ndata: ${JSON.stringify({ boot: bootId })}\n\n`);
      clients.set(res, url.searchParams.get('client') === 'app' ? 'app' : 'browser');
      req.on('close', () => clients.delete(res));
      return undefined;
    }
    return sendJson(res, 404, { error: 'not found' });
  }

  const server = http.createServer((req, res) => {
    if (!isAllowedHost(req.headers.host, server.address()?.port)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      handleApi(req, res, url).catch((error) => sendJson(res, 500, { error: String(error.message ?? error) }));
      return;
    }
    serveStatic(uiDir, url.pathname, res);
  });

  const heartbeat = setInterval(() => {
    for (const res of clients.keys()) res.write(': ping\n\n');
  }, 25_000);
  heartbeat.unref();

  server.on('close', () => {
    watcher.close();
    clearInterval(pruneTimer);
    clearInterval(heartbeat);
    for (const res of clients.keys()) res.end();
  });
  return server;
}
