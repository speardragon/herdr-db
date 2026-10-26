import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { agentFromEnv, AGENTS, detectedAgents } from '../src/agents.mjs';
import { codexServerConfigs, sanitizeServerName } from '../src/codex-config.mjs';
import { resolveConnectionString, resolveServerName } from '../src/connection.mjs';
import { handleHookPayload } from '../src/hook.mjs';
import { buildEvent, parseToolResponse, summarize } from '../src/normalize.mjs';
import { addHooks, desiredHooks, hookCommand, hookStatus, installedHooks } from '../src/settings.mjs';
import { readEvent } from '../src/store.mjs';
import { CAPTURED_TOOLS, parseToolName, toolMatcher } from '../src/tools.mjs';
import { fixture, tempHome, testContext } from './helpers.mjs';

const CODEX_TOML = `
model = "gpt"

[mcp_servers.shop-db]
command = "npx"
args = ["-y", "mongodb-mcp-server"]
env = { MDB_MCP_CONNECTION_STRING = "mongodb://codex-user" }

[mcp_servers.flagged]
command = "npx"
args = ["-y", "mongodb-mcp-server", "--connectionString", "mongodb://codex-flag", "--readOnly"]
`;

function codexHome(t, { project } = {}) {
  const { home, paths, cleanup } = tempHome();
  t.after(cleanup);
  const codex = path.join(home, 'codex-home');
  fs.mkdirSync(codex);
  fs.writeFileSync(path.join(codex, 'config.toml'), CODEX_TOML);
  const cwd = path.join(home, 'work', 'app');
  fs.mkdirSync(path.join(cwd, '.codex'), { recursive: true });
  if (project) fs.writeFileSync(path.join(cwd, '.codex', 'config.toml'), project);
  return { paths, cwd, env: { CODEX_HOME: codex, HERDR_DB_AGENT: 'codex' } };
}

// Codex sends the serialized MCP CallToolResult and sanitizes names (`-` becomes `_`).
function codexPayload(tool, input, result, cwd) {
  return {
    session_id: 'codex-session',
    turn_id: 'turn-1',
    transcript_path: null,
    cwd,
    hook_event_name: 'PostToolUse',
    model: 'gpt',
    permission_mode: 'default',
    tool_name: `mcp__shop_db__${tool}`,
    tool_use_id: 'call_1',
    tool_input: input,
    tool_response: result,
  };
}

test('parseToolName accepts Codex sanitized tool names', () => {
  assert.deepEqual(parseToolName('mcp__shop_db__update_many'), { server: 'shop_db', tool: 'update-many' });
  assert.deepEqual(parseToolName('mcp__analytics_db__list_collections'), { server: 'analytics_db', tool: 'list-collections' });
  const re = new RegExp(toolMatcher(CAPTURED_TOOLS));
  assert.ok(re.test('mcp__shop_db__update_many'));
  assert.ok(re.test('mcp__shop-db__update-many'));
  assert.ok(!re.test('mcp__shop_db__find_files'));
});

test('Codex hooks register Pre/Post only, tagged with the agent', () => {
  const command = hookCommand('/usr/bin/node', '/p/bin/hook.mjs', 'codex');
  assert.match(command, /^HERDR_DB_HOOK=1 HERDR_DB_AGENT=codex /);
  assert.deepEqual(Object.keys(desiredHooks(command, 'codex')), ['PreToolUse', 'PostToolUse']);
  assert.equal(desiredHooks(command, 'codex').PostToolUse.hooks[0].timeout, 15);

  // Codex trust is keyed by array index, so our group must go after the user's own hooks.
  const existing = { hooks: { PostToolUse: [{ matcher: '^Bash$', hooks: [{ type: 'command', command: 'atuin hook codex' }] }] } };
  const next = addHooks(existing, command, 'codex');
  assert.equal(next.hooks.PostToolUse[0].hooks[0].command, 'atuin hook codex');
  assert.equal(installedHooks(next).length, 2);
  assert.deepEqual(addHooks(next, command, 'codex'), next);
});

test('agents are detected from their config directories', (t) => {
  const { env } = codexHome(t);
  assert.equal(agentFromEnv({}), 'claude');
  assert.equal(agentFromEnv({ HERDR_DB_AGENT: 'codex' }), 'codex');
  assert.equal(agentFromEnv({ HERDR_DB_AGENT: 'nope' }), 'claude');
  assert.equal(AGENTS.codex.hooksFile(env), path.join(env.CODEX_HOME, 'hooks.json'));
  assert.ok(detectedAgents(env).includes('codex'));
  assert.ok(!detectedAgents({ CODEX_HOME: '/nonexistent/codex', CLAUDE_CONFIG_DIR: '/nonexistent/claude' }).includes('codex'));
});

test('Codex server names resolve back to the config.toml key and connection string', (t) => {
  const { cwd, env } = codexHome(t);
  assert.equal(sanitizeServerName('analytics-db'), 'analytics_db');
  assert.deepEqual(
    codexServerConfigs('shop_db', { cwd, env }).map((entry) => entry.name),
    ['shop-db'],
  );
  assert.equal(resolveServerName('codex', 'shop_db', { cwd, env }), 'shop-db');
  assert.equal(resolveServerName('codex', 'unknown_server', { cwd, env }), 'unknown_server');
  assert.equal(resolveServerName('claude', 'shop-db', { cwd, env }), 'shop-db');
  assert.equal(resolveConnectionString('shop_db', { agent: 'codex', cwd, env }), 'mongodb://codex-user');
  assert.equal(resolveConnectionString('flagged', { agent: 'codex', cwd, env }), 'mongodb://codex-flag');
  assert.equal(resolveConnectionString('missing', { agent: 'codex', cwd, env }), null);
});

test('a project .codex/config.toml wins over the user one', (t) => {
  const project = '[mcp_servers.shop-db]\nenv = { MDB_MCP_CONNECTION_STRING = "mongodb://codex-project" }\n';
  const { cwd, env } = codexHome(t, { project });
  assert.equal(resolveConnectionString('shop_db', { agent: 'codex', cwd, env }), 'mongodb://codex-project');
});

test('a broken config.toml is ignored rather than thrown', (t) => {
  const { cwd, env } = codexHome(t, { project: 'this is = = not toml' });
  assert.equal(resolveConnectionString('shop_db', { agent: 'codex', cwd, env }), 'mongodb://codex-user');
});

test('CallToolResult errors without structured content keep their message', () => {
  const parsed = parseToolResponse({ content: [{ type: 'text', text: 'unknown top level operator: $bad' }], isError: true });
  assert.equal(parsed.status, 'error');
  assert.match(parsed.text, /unknown top level operator/);
});

test('Codex find calls become events tagged with the agent and real server name', async (t) => {
  const { paths, cwd, env } = codexHome(t);
  const { ctx, launched } = testContext(paths, { env });
  const documents = [{ _id: { $oid: '6adedc58761ef473c665d0fb' }, name: 'Kim' }];
  const result = { content: [{ type: 'text', text: 'Found 1 document' }], structuredContent: { documents } };
  const outcome = await handleHookPayload(codexPayload('find', { database: 'app', collection: 'users', filter: {} }, result, cwd), ctx);

  const event = readEvent(paths.events, outcome.eventId);
  assert.equal(event.agent, 'codex');
  assert.equal(event.server, 'shop-db');
  assert.equal(event.tool, 'find');
  assert.equal(event.kind, 'read');
  assert.deepEqual(event.result.documents, documents);
  assert.equal(summarize(event).agent, 'codex');
  assert.deepEqual(launched, [outcome.eventId]);
});

test('Codex update_many is snapshotted with the connection from config.toml', async (t) => {
  const { paths, cwd, env } = codexHome(t);
  const uris = [];
  const { ctx } = testContext(paths, {
    env,
    capture: {
      before: async ({ uri }) => {
        uris.push(uri);
        return { documents: [{ _id: 1, a: 1 }], truncated: false, matched: 1 };
      },
      after: async ({ uri }) => {
        uris.push(uri);
        return [{ _id: 1, a: 2 }];
      },
    },
  });
  const input = { database: 'app', collection: 'users', filter: { a: 1 }, update: { $set: { a: 2 } } };
  const post = codexPayload('update_many', input, { content: [], structuredContent: { matchedCount: 1, modifiedCount: 1 } }, cwd);
  assert.equal((await handleHookPayload({ ...post, hook_event_name: 'PreToolUse', tool_response: undefined }, ctx)).snapshot, 'captured');
  const outcome = await handleHookPayload(post, ctx);
  const event = readEvent(paths.events, outcome.eventId);
  assert.equal(event.tool, 'update-many');
  assert.deepEqual(event.snapshot.after, [{ _id: 1, a: 2 }]);
  assert.deepEqual(uris, ['mongodb://codex-user', 'mongodb://codex-user']);
});

test('Claude Code events default to the claude agent', () => {
  const event = buildEvent(fixture('find'), { env: {} });
  assert.equal(event.agent, 'claude');
  assert.equal(event.server, 'local-mongodb');
});

test('hookStatus reports each agent separately', (t) => {
  const { env } = codexHome(t);
  const claudeDir = path.join(path.dirname(env.CODEX_HOME), 'claude-home');
  const both = { ...env, CLAUDE_CONFIG_DIR: claudeDir };
  const command = hookCommand('/nonexistent/node', '/p/bin/hook.mjs', 'codex');
  fs.writeFileSync(AGENTS.codex.hooksFile(both), JSON.stringify(addHooks({}, command, 'codex')));

  const status = hookStatus(both);
  assert.deepEqual(status.codex.events, ['PreToolUse', 'PostToolUse']);
  assert.equal(status.codex.nodePathMissing, true);
  assert.equal(status.codex.detected, true);
  assert.deepEqual(status.claude.events, []);
  assert.equal(status.claude.detected, false);

  fs.writeFileSync(AGENTS.codex.hooksFile(both), '{broken');
  assert.equal(hookStatus(both).codex.unreadable, true);
});
