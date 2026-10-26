import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvent, parseToolResponse, summarize } from '../src/normalize.mjs';
import { fixture } from './helpers.mjs';

test('parseToolResponse reads the structuredContent JSON string Claude Code passes to hooks', () => {
  const parsed = parseToolResponse(fixture('find').tool_response);
  assert.equal(parsed.status, 'ok');
  assert.equal(parsed.data.documents.length, 2);
  assert.deepEqual(parsed.data.documents[0]._id, { $oid: '6adedc58761ef473c665d0fb' });
});

test('parseToolResponse flags error text', () => {
  const parsed = parseToolResponse('Error: Error running collection-indexes: not allowed');
  assert.equal(parsed.status, 'error');
  assert.match(parsed.text, /not allowed/);
});

test('parseToolResponse accepts MCP content blocks and full results', () => {
  assert.deepEqual(parseToolResponse([{ type: 'text', text: '{"count":3}' }]).data, { count: 3 });
  const full = parseToolResponse({ content: [{ type: 'text', text: 'ok' }], structuredContent: { count: 5 } });
  assert.deepEqual(full.data, { count: 5 });
  assert.equal(parseToolResponse({ isError: true, content: [], structuredContent: {} }).status, 'error');
});

test('parseToolResponse extracts documents from legacy untrusted-data text', () => {
  const text = 'Found 1 documents\n<untrusted-user-data-abc-123>\n[{"a":1}]\n</untrusted-user-data-abc-123>';
  assert.deepEqual(parseToolResponse(text).data, { documents: [{ a: 1 }] });
  assert.equal(parseToolResponse('').data, null);
  assert.equal(parseToolResponse('Deleted `2` document(s).').data, null);
});

test('buildEvent normalizes namespace, kind and herdr context', () => {
  const env = { HERDR_WORKSPACE_ID: 'w1', HERDR_TAB_ID: 'w1:t1', HERDR_PANE_ID: 'w1:p1' };
  const event = buildEvent(fixture('update'), { env, now: Date.UTC(2026, 0, 1) });
  assert.equal(event.tool, 'update-many');
  assert.equal(event.kind, 'write');
  assert.equal(event.server, 'local-mongodb');
  assert.deepEqual(event.namespace, { database: 'herdr_db_test', collection: 'users' });
  assert.equal(event.result.modifiedCount, 1);
  assert.equal(event.context.project, 'project');
  assert.deepEqual(event.context.herdr, { workspaceId: 'w1', tabId: 'w1:t1', paneId: 'w1:p1' });
  assert.equal(event.ts, '2026-01-01T00:00:00.000Z');
  assert.match(event.id, /^[0-9a-z]+-[0-9a-f]{8}$/);
});

test('buildEvent records PostToolUseFailure as an error', () => {
  const payload = { ...fixture('find'), hook_event_name: 'PostToolUseFailure', tool_response: undefined, error: 'boom' };
  const event = buildEvent(payload, { env: {} });
  assert.equal(event.status, 'error');
  assert.equal(event.resultText, 'boom');
  assert.equal(event.context.herdr, null);
});

test('buildEvent rejects non-MCP tools', () => {
  assert.throws(() => buildEvent({ tool_name: 'Bash' }), /Not an MCP tool/);
});

test('summarize exposes counts for the sidebar', () => {
  const find = summarize(buildEvent(fixture('find'), { env: {} }));
  assert.equal(find.count, 2);
  assert.equal(find.total, 2);
  const update = summarize(buildEvent(fixture('update'), { env: {} }));
  assert.equal(update.count, 1);
  assert.equal(update.total, null);
});
