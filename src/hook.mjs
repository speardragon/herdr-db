import { appendLog, ensureDirs, loadConfig, pathsFor, resolveHome } from './config.mjs';
import { agentFromEnv } from './agents.mjs';
import { resolveConnectionString, resolveServerName } from './connection.mjs';
import { buildEvent } from './normalize.mjs';
import { captureAfter, captureBefore, prunePending, savePending, takePending } from './snapshot.mjs';
import { writeEvent } from './store.mjs';
import { looksLikeMongoCall, needsSnapshot, parseToolName } from './tools.mjs';
import { ensureServer, openViewer, serverStatus, shouldOpen, waitForServer } from './launcher.mjs';

const POST_EVENTS = new Set(['PostToolUse', 'PostToolUseFailure']);

function snapshotTarget(payload, parsed, config, env) {
  const input = payload.tool_input ?? {};
  if (!needsSnapshot(parsed.tool) || !input.database || !input.collection) return null;
  // Runtime connections made with the `connect` tool are invisible to us.
  if (input.connectionId && input.connectionId !== 'preconfigured') return { unavailable: 'runtime-connection' };
  const uri = resolveConnectionString(payload.mcp_server?.name ?? parsed.server, { agent: agentFromEnv(env), cwd: payload.cwd, env });
  if (!uri) return { unavailable: 'connection-string-not-found' };
  return { uri, database: input.database, collection: input.collection, timeoutMs: config.snapshotTimeoutMs };
}

async function handlePre(payload, parsed, ctx) {
  const target = snapshotTarget(payload, parsed, ctx.config, ctx.env);
  if (!target) return null;
  prunePending(ctx.paths.pending);
  if (target.unavailable) {
    savePending(ctx.paths.pending, payload.tool_use_id, { error: target.unavailable });
    return 'unavailable';
  }
  try {
    const before = await ctx.capture.before({ ...target, filter: payload.tool_input.filter, limit: ctx.config.snapshotLimit });
    savePending(ctx.paths.pending, payload.tool_use_id, before);
    return 'captured';
  } catch (error) {
    savePending(ctx.paths.pending, payload.tool_use_id, { error: `before: ${error.message}` });
    return 'failed';
  }
}

function idsToRefetch(before, result) {
  const ids = (before.documents ?? []).map((doc) => doc._id).filter((id) => id !== undefined);
  // update-many reports an upserted id as a plain string; only ObjectId-looking ones can be refetched safely.
  if (typeof result?.upsertedId === 'string' && /^[0-9a-f]{24}$/.test(result.upsertedId)) {
    return [...ids, { $oid: result.upsertedId }];
  }
  return ids;
}

async function completeSnapshot(payload, parsed, ctx, result) {
  if (!needsSnapshot(parsed.tool)) return null;
  const before = takePending(ctx.paths.pending, payload.tool_use_id);
  if (!before) return { error: 'no-before-snapshot' };
  if (before.error) return { error: before.error };
  const target = snapshotTarget(payload, parsed, ctx.config, ctx.env);
  try {
    const after = await ctx.capture.after({ ...target, ids: idsToRefetch(before, result) });
    return { before: before.documents, after, truncated: before.truncated, matched: before.matched };
  } catch (error) {
    return { before: before.documents, after: null, truncated: before.truncated, matched: before.matched, error: `after: ${error.message}` };
  }
}

async function handlePost(payload, parsed, ctx) {
  const agent = agentFromEnv(ctx.env);
  const server = payload.mcp_server?.name ?? resolveServerName(agent, parsed.server, { cwd: payload.cwd, env: ctx.env });
  const draft = buildEvent(payload, { env: ctx.env, now: ctx.now(), agent, server });
  const snapshot = draft.status === 'ok' ? await completeSnapshot(payload, parsed, ctx, draft.result) : null;
  if (!snapshot && needsSnapshot(parsed.tool)) takePending(ctx.paths.pending, payload.tool_use_id);
  const event = { ...draft, snapshot };
  writeEvent(ctx.paths.events, event);

  if (!shouldOpen(ctx.config, event.kind)) return event;
  await ctx.launch(event);
  return event;
}

async function defaultLaunch(config, paths) {
  const started = await ensureServer(config, paths);
  if (started) await waitForServer(config);
  const { browser } = await serverStatus(config);
  openViewer(config, { clients: browser });
}

export function defaultContext(env = process.env) {
  const paths = pathsFor(resolveHome(env));
  const config = loadConfig(paths);
  return {
    env,
    paths,
    config,
    now: () => Date.now(),
    capture: { before: captureBefore, after: captureAfter },
    launch: () => defaultLaunch(config, paths),
  };
}

/** Returns what happened, for tests and logs. Never throws for unrelated tool calls. */
export async function handleHookPayload(payload, ctx) {
  const parsed = parseToolName(payload?.tool_name);
  if (!parsed || !looksLikeMongoCall(parsed, payload.tool_input ?? {})) return { skipped: true };
  ensureDirs(ctx.paths);

  if (payload.hook_event_name === 'PreToolUse') {
    return { phase: 'pre', snapshot: await handlePre(payload, parsed, ctx) };
  }
  if (POST_EVENTS.has(payload.hook_event_name)) {
    const event = await handlePost(payload, parsed, ctx);
    return { phase: 'post', eventId: event.id };
  }
  return { skipped: true };
}

export async function runHook(stdinText, ctx = defaultContext()) {
  try {
    return await handleHookPayload(JSON.parse(stdinText), ctx);
  } catch (error) {
    appendLog(ctx.paths.hookLog, `hook error: ${error.stack ?? error}`);
    return { error: String(error.message ?? error) };
  }
}
