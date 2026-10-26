import { herdrBin, runHerdr } from './herdr-cli.mjs';

// The hook waits for these, so keep them well inside the agent's hook timeout.
const TIMEOUT_MS = 800;

const defaultRun = (bin, args) => runHerdr(bin, args, { timeoutMs: TIMEOUT_MS });

async function lookup(run, bin, args, pick) {
  if (!args.at(-1)) return null;
  try {
    const value = pick((await run(bin, args))?.result);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Names of the herdr workspace, tab and pane a call came from, read when the call happens so the
 * history keeps them after a tab is renamed or closed. Returns null outside herdr.
 */
export async function herdrSessionLabels(ids, { env = process.env, run = defaultRun } = {}) {
  if (!ids) return null;
  const bin = herdrBin(env);
  const [workspaceLabel, tabLabel, paneTitle] = await Promise.all([
    lookup(run, bin, ['workspace', 'get', ids.workspaceId], (result) => result?.workspace?.label),
    lookup(run, bin, ['tab', 'get', ids.tabId], (result) => result?.tab?.label),
    lookup(run, bin, ['pane', 'get', ids.paneId], (result) => result?.pane?.terminal_title_stripped ?? result?.pane?.terminal_title),
  ]);
  return { workspaceLabel, tabLabel, paneTitle };
}
