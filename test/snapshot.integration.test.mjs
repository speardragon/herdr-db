// Runs only when HERDR_DB_TEST_URI points at a disposable MongoDB, e.g.
//   HERDR_DB_TEST_URI='mongodb://localhost:27017/?directConnection=true' npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { captureAfter, captureBefore } from '../src/snapshot.mjs';

const uri = process.env.HERDR_DB_TEST_URI;
const database = 'herdr_db_test';
const collection = `snapshot_${process.pid}`;

test('captureBefore/captureAfter round-trip a real update', { skip: !uri && 'HERDR_DB_TEST_URI not set' }, async (t) => {
  const client = new MongoClient(uri);
  await client.connect();
  const coll = client.db(database).collection(collection);
  t.after(async () => {
    await coll.drop().catch(() => {});
    await client.close();
  });
  await coll.insertMany([{ name: 'Kim', age: 31 }, { name: 'Lee', age: 25 }, { name: 'Lee', age: 40 }]);

  const before = await captureBefore({ uri, database, collection, filter: { name: 'Lee' }, limit: 1, timeoutMs: 3000 });
  assert.equal(before.documents.length, 1);
  assert.equal(before.truncated, true);
  assert.equal(before.matched, 2);
  assert.deepEqual(before.documents[0].age, { $numberInt: '25' }, 'canonical EJSON keeps Int32');

  await coll.updateMany({ name: 'Lee' }, { $set: { name: 'Park' } });
  const after = await captureAfter({ uri, database, collection, ids: [before.documents[0]._id], timeoutMs: 3000 });
  assert.equal(after.length, 1);
  assert.equal(after[0].name, 'Park', 're-read by _id even though the filter no longer matches');

  const byOid = await captureBefore({ uri, database, collection, filter: { _id: before.documents[0]._id }, limit: 5, timeoutMs: 3000 });
  assert.equal(byOid.documents.length, 1, 'EJSON filters such as {$oid} are deserialized');
});
