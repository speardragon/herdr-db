import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURED_TOOLS, classifyTool, looksLikeMongoCall, parseToolName, toolMatcher } from '../src/tools.mjs';

test('parseToolName splits server and tool, including servers with underscores', () => {
  assert.deepEqual(parseToolName('mcp__shop-db__find'), { server: 'shop-db', tool: 'find' });
  assert.deepEqual(parseToolName('mcp__plugin_db_mongo__update-many'), { server: 'plugin_db_mongo', tool: 'update-many' });
  assert.equal(parseToolName('Bash'), null);
  assert.equal(parseToolName(undefined), null);
});

test('classifyTool separates reads, writes, admin and metadata', () => {
  assert.equal(classifyTool('find'), 'read');
  assert.equal(classifyTool('update-many'), 'write');
  assert.equal(classifyTool('drop-collection'), 'admin');
  assert.equal(classifyTool('list-collections'), 'meta');
  assert.equal(classifyTool('unknown-tool'), null);
});

test('aggregate with $out or $merge counts as a write', () => {
  assert.equal(classifyTool('aggregate', { pipeline: [{ $match: {} }] }), 'read');
  assert.equal(classifyTool('aggregate', { pipeline: [{ $match: {} }, { $out: 'copy' }] }), 'write');
  assert.equal(classifyTool('aggregate', { pipeline: [{ $merge: { into: 'x' } }] }), 'write');
});

test('looksLikeMongoCall rejects same-named tools from other servers', () => {
  assert.equal(looksLikeMongoCall({ server: 'shop-mongodb', tool: 'find' }, {}), true);
  assert.equal(looksLikeMongoCall({ server: 'files', tool: 'find' }, { pattern: '*.ts' }), false);
  assert.equal(looksLikeMongoCall({ server: 'db', tool: 'find' }, { database: 'app', collection: 'users' }), true);
  assert.equal(looksLikeMongoCall({ server: 'mongo', tool: 'connect' }, {}), false);
});

test('toolMatcher is an anchored regex over the given tools', () => {
  const re = new RegExp(toolMatcher(CAPTURED_TOOLS));
  assert.ok(re.test('mcp__analytics-db__aggregate'));
  assert.ok(re.test('mcp__stg-shop-db__update-many'));
  assert.ok(!re.test('mcp__x__find-files'));
  assert.ok(!re.test('Read'));
});
