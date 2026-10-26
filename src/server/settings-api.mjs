import { EDITABLE_KEYS, updateConfig } from '../config.mjs';
import { effectiveViewer, hasNativeApp, openViewer } from '../launcher.mjs';
import { hookStatus } from '../settings.mjs';
import { listEventIds } from '../store.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const NAVIGABLE_VIEWS = new Set(['settings', 'events']);

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

// Requiring a JSON content type forces a CORS preflight for cross-origin pages, which we never answer.
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) {
      reject(new Error('content-type must be application/json'));
      return;
    }
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
  });
}

function editable(config) {
  return Object.fromEntries(EDITABLE_KEYS.map((key) => [key, config[key]]));
}

/**
 * GET/PUT /api/settings and POST /api/navigate.
 * Switching the viewer mode opens the new viewer right away; the native window closes itself
 * when it receives the `config` event with viewer = browser.
 */
export function createSettingsApi({ paths, getConfig, setConfig, broadcast, clientCounts, launch = openViewer, hooks = hookStatus }) {
  function snapshot() {
    const config = getConfig();
    return {
      settings: editable(config),
      status: {
        port: config.port,
        home: paths.home,
        hooks: hooks(),
        appBuilt: hasNativeApp(config),
        effectiveViewer: effectiveViewer(config),
        events: listEventIds(paths.events).length,
        viewers: clientCounts(),
      },
    };
  }

  async function update(req, res) {
    const previous = getConfig();
    let next;
    try {
      // Only the edited fields change; everything else stays as the server was started with.
      next = { ...previous, ...editable(updateConfig(paths, await readJsonBody(req))) };
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
    setConfig(next);
    broadcast('config', { settings: editable(next), effectiveViewer: effectiveViewer(next) });
    if (effectiveViewer(previous) !== effectiveViewer(next)) {
      launch(next, { background: false, clients: effectiveViewer(next) === 'browser' ? clientCounts().browser : 0 });
    }
    return sendJson(res, 200, snapshot());
  }

  async function navigate(req, res) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
    if (!NAVIGABLE_VIEWS.has(body.view)) return sendJson(res, 400, { error: 'unknown view' });
    broadcast('navigate', { view: body.view });
    return sendJson(res, 200, { ok: true });
  }

  /** Returns true when the request was handled. */
  return async function handle(req, res, url) {
    if (url.pathname === '/api/settings' && req.method === 'GET') {
      sendJson(res, 200, snapshot());
      return true;
    }
    if (url.pathname === '/api/settings' && req.method === 'PUT') {
      await update(req, res);
      return true;
    }
    if (url.pathname === '/api/navigate' && req.method === 'POST') {
      await navigate(req, res);
      return true;
    }
    return false;
  };
}
