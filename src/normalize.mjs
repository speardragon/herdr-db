import crypto from 'node:crypto';
import path from 'node:path';
import { classifyTool, parseToolName } from './tools.mjs';

const UNTRUSTED_BLOCK = /<untrusted-user-data-[\w-]+>([\s\S]*?)<\/untrusted-user-data-[\w-]+>/g;

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => (block && typeof block.text === 'string' ? block.text : ''))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Older server versions only returned text, with documents wrapped in untrusted-data tags.
function documentsFromText(text) {
  const documents = [];
  for (const [, inner] of text.matchAll(UNTRUSTED_BLOCK)) {
    const parsed = tryJson(inner.trim());
    if (Array.isArray(parsed)) documents.push(...parsed);
    else if (parsed && typeof parsed === 'object') documents.push(parsed);
  }
  return documents;
}

/**
 * Claude Code hands MCP results to PostToolUse as the structuredContent JSON string;
 * Codex hands over the whole CallToolResult ({ content, structuredContent, isError }).
 * Falls back to content blocks and plain text so the viewer can still show something.
 */
export function parseToolResponse(response) {
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    if (response.structuredContent && typeof response.structuredContent === 'object') {
      return { status: response.isError ? 'error' : 'ok', data: response.structuredContent, text: textOf(response.content) };
    }
    if (response.isError) return { status: 'error', data: null, text: textOf(response.content) || 'Tool call failed' };
    if ('content' in response) return parseToolResponse(response.content);
    return { status: 'ok', data: response, text: '' };
  }

  const text = textOf(response).trim();
  if (!text) return { status: 'ok', data: null, text: '' };

  const parsed = tryJson(text);
  if (parsed && typeof parsed === 'object') return { status: 'ok', data: parsed, text: '' };

  if (/^(MCP error|Error)\b/i.test(text)) return { status: 'error', data: null, text };

  const documents = documentsFromText(text);
  return { status: 'ok', data: documents.length ? { documents } : null, text };
}

export function newEventId(now = Date.now()) {
  return `${now.toString(36).padStart(9, '0')}-${crypto.randomBytes(4).toString('hex')}`;
}

function herdrContext(env) {
  if (!env.HERDR_PANE_ID && !env.HERDR_WORKSPACE_ID) return null;
  return {
    workspaceId: env.HERDR_WORKSPACE_ID ?? null,
    tabId: env.HERDR_TAB_ID ?? null,
    paneId: env.HERDR_PANE_ID ?? null,
  };
}

export function buildEvent(payload, { env = process.env, now = Date.now(), snapshot = null, agent = 'claude', server } = {}) {
  const parsedName = parseToolName(payload.tool_name);
  if (!parsedName) throw new Error(`Not an MCP tool: ${payload.tool_name}`);

  const input = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};
  const failed = payload.hook_event_name === 'PostToolUseFailure';
  const response = failed
    ? { status: 'error', data: null, text: String(payload.error ?? 'Tool call failed') }
    : parseToolResponse(payload.tool_response);

  const cwd = typeof payload.cwd === 'string' ? payload.cwd : '';
  return {
    id: newEventId(now),
    ts: new Date(now).toISOString(),
    agent,
    server: server ?? payload.mcp_server?.name ?? parsedName.server,
    tool: parsedName.tool,
    kind: classifyTool(parsedName.tool, input),
    status: response.status,
    namespace: {
      database: typeof input.database === 'string' ? input.database : null,
      collection: typeof input.collection === 'string' ? input.collection : null,
    },
    input,
    result: response.data,
    resultText: response.text || null,
    snapshot,
    durationMs: Number.isFinite(payload.duration_ms) ? payload.duration_ms : null,
    context: {
      sessionId: payload.session_id ?? null,
      toolUseId: payload.tool_use_id ?? null,
      cwd,
      project: cwd ? path.basename(cwd) : null,
      herdr: herdrContext(env),
    },
  };
}

function countFrom(event) {
  const result = event.result ?? {};
  if (Array.isArray(result.documents)) return result.documents.length;
  for (const key of ['count', 'insertedCount', 'modifiedCount', 'deletedCount']) {
    if (Number.isFinite(result[key])) return result[key];
  }
  return null;
}

export function summarize(event) {
  return {
    id: event.id,
    ts: event.ts,
    agent: event.agent ?? 'claude',
    server: event.server,
    tool: event.tool,
    kind: event.kind,
    status: event.status,
    namespace: event.namespace,
    count: countFrom(event),
    total: Number.isFinite(event.result?.queryResultsCount) ? event.result.queryResultsCount : null,
    project: event.context?.project ?? null,
    sessionId: event.context?.sessionId ?? null,
    herdr: event.context?.herdr ?? null,
  };
}
