// Tool names exposed by mongodb-mcp-server (mongodb-js/mongodb-mcp-server).
const KIND_BY_TOOL = Object.freeze({
  find: 'read',
  aggregate: 'read',
  'aggregate-db': 'read',
  count: 'read',
  export: 'read',
  'insert-many': 'write',
  'update-many': 'write',
  'delete-many': 'write',
  'create-index': 'admin',
  'drop-index': 'admin',
  'create-collection': 'admin',
  'drop-collection': 'admin',
  'drop-database': 'admin',
  'rename-collection': 'admin',
  'list-databases': 'meta',
  'list-collections': 'meta',
  'collection-schema': 'meta',
  'collection-indexes': 'meta',
  'collection-storage-size': 'meta',
  'db-stats': 'meta',
  explain: 'meta',
});

// Writes whose result carries only counts, so the documents must be captured around the call.
export const SNAPSHOT_TOOLS = Object.freeze(['update-many', 'delete-many']);

export const CAPTURED_TOOLS = Object.freeze(Object.keys(KIND_BY_TOOL));

// Codex sanitizes tool names (`update-many` -> `update_many`); MongoDB tool names never contain `_`.
export function parseToolName(toolName) {
  const match = /^mcp__(.+)__([a-z][a-z_-]*)$/.exec(String(toolName ?? ''));
  if (!match) return null;
  return { server: match[1], tool: match[2].replace(/_/g, '-') };
}

function pipelineWrites(pipeline) {
  return Array.isArray(pipeline) && pipeline.some((stage) => stage && ('$out' in stage || '$merge' in stage));
}

export function classifyTool(tool, input = {}) {
  const kind = KIND_BY_TOOL[tool] ?? null;
  if (kind === 'read' && tool.startsWith('aggregate') && pipelineWrites(input.pipeline)) {
    return 'write';
  }
  return kind;
}

export function needsSnapshot(tool) {
  return SNAPSHOT_TOOLS.includes(tool);
}

// Other MCP servers may expose a tool called `find` or `count`; only accept calls that look like MongoDB ones.
export function looksLikeMongoCall({ server, tool }, input = {}) {
  if (!(tool in KIND_BY_TOOL)) return false;
  if (/mongo/i.test(server)) return true;
  return typeof input.connectionId === 'string' || typeof input.database === 'string';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One matcher for both agents: `-` in a tool name also matches Codex's `_`. */
export function toolMatcher(tools) {
  return `^mcp__.+__(${tools.map((tool) => escapeRegex(tool).replace(/-/g, '[-_]')).join('|')})$`;
}
