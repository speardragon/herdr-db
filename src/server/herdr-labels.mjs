import { execFile } from 'node:child_process';

const CACHE_MS = 15_000;

function runHerdr(bin, args) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 2000 }, (error, stdout) => {
      if (error) return resolve(null);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(null);
      }
    });
  });
}

/** Maps herdr workspace ids to their labels so the viewer can say which agent made a call. */
export function createHerdrLabels({ env = process.env, run = runHerdr } = {}) {
  const bin = env.HERDR_BIN_PATH || 'herdr';
  let cache = { at: 0, labels: new Map() };

  async function refresh() {
    const response = await run(bin, ['workspace', 'list']);
    const workspaces = response?.result?.workspaces;
    if (!Array.isArray(workspaces)) return cache.labels;
    const labels = new Map(workspaces.map((ws) => [ws.workspace_id, ws.label]));
    cache = { at: Date.now(), labels };
    return labels;
  }

  return async function workspaceLabels() {
    if (Date.now() - cache.at < CACHE_MS) return cache.labels;
    return refresh();
  };
}
