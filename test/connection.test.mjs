import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { connectionStringFromServer, expandEnvRefs, resolveConnectionString } from '../src/connection.mjs';

function fakeFiles(files) {
  return (file) => files[file] ?? null;
}

test('expandEnvRefs supports ${VAR} and ${VAR:-default}', () => {
  assert.equal(expandEnvRefs('${A}/${B:-x}', { A: 'one' }), 'one/x');
});

test('connectionStringFromServer reads env, flag and positional forms', () => {
  assert.equal(connectionStringFromServer({ env: { MDB_MCP_CONNECTION_STRING: 'mongodb://a' } }, {}), 'mongodb://a');
  assert.equal(connectionStringFromServer({ args: ['-y', 'mongodb-mcp-server', '--connectionString', 'mongodb://b'] }, {}), 'mongodb://b');
  assert.equal(connectionStringFromServer({ args: ['--connectionString=mongodb://c'] }, {}), 'mongodb://c');
  assert.equal(connectionStringFromServer({ args: ['mongodb-mcp-server', 'mongodb+srv://d'] }, {}), 'mongodb+srv://d');
  assert.equal(connectionStringFromServer({ env: { MDB_MCP_CONNECTION_STRING: '${URI}' } }, { URI: 'mongodb://e' }), 'mongodb://e');
  assert.equal(connectionStringFromServer({ args: [] }, {}), null);
});

test('resolveConnectionString prefers project scope, then .mcp.json, then user scope', () => {
  const home = '/home/u';
  const claudeJson = {
    mcpServers: { db: { env: { MDB_MCP_CONNECTION_STRING: 'mongodb://user' } } },
    projects: { '/work/app': { mcpServers: { db: { env: { MDB_MCP_CONNECTION_STRING: 'mongodb://project' } } } } },
  };
  const read = fakeFiles({
    [path.join(home, '.claude.json')]: claudeJson,
    '/work/app/sub/.mcp.json': { mcpServers: { db: { env: { MDB_MCP_CONNECTION_STRING: 'mongodb://mcpjson' } } } },
  });
  assert.equal(resolveConnectionString('db', { cwd: '/work/app', home, read, env: {} }), 'mongodb://project');
  assert.equal(resolveConnectionString('db', { cwd: '/work/app/sub', home, read, env: {} }), 'mongodb://mcpjson');
  assert.equal(resolveConnectionString('db', { cwd: '/elsewhere', home, read, env: {} }), 'mongodb://user');
  assert.equal(resolveConnectionString('other', { cwd: '/work/app', home, read, env: {} }), null);
});

test('resolveConnectionString honours a per-server env override', () => {
  const env = { 'HERDR_DB_URI_SHOP_DB': 'mongodb://override' };
  assert.equal(resolveConnectionString('shop-db', { cwd: '/x', home: '/h', read: () => null, env }), 'mongodb://override');
});
