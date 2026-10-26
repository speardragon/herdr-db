import fs from 'node:fs';
import path from 'node:path';
import { EJSON } from 'bson';

const CANONICAL = { relaxed: false };

function clientOptions(timeoutMs) {
  return {
    appName: 'herdr-db',
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs,
    socketTimeoutMS: timeoutMs,
    maxPoolSize: 1,
  };
}

async function withCollection({ uri, database, collection, timeoutMs }, work) {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri, clientOptions(timeoutMs));
  try {
    await client.connect();
    return await work(client.db(database).collection(collection));
  } finally {
    await client.close().catch(() => {});
  }
}

/** Documents the write is about to touch, captured from PreToolUse. */
export async function captureBefore({ uri, database, collection, filter, limit, timeoutMs }) {
  const query = EJSON.deserialize(filter ?? {});
  return withCollection({ uri, database, collection, timeoutMs }, async (coll) => {
    const docs = await coll.find(query, { limit: limit + 1, maxTimeMS: timeoutMs }).toArray();
    const matched = await coll.countDocuments(query, { maxTimeMS: timeoutMs }).catch(() => null);
    return {
      documents: docs.slice(0, limit).map((doc) => EJSON.serialize(doc, CANONICAL)),
      truncated: docs.length > limit,
      matched,
    };
  });
}

/** Re-reads the same documents by _id, so an update that no longer matches the filter is still shown. */
export async function captureAfter({ uri, database, collection, ids, timeoutMs }) {
  if (!ids.length) return [];
  const idValues = ids.map((id) => EJSON.deserialize({ v: id }).v);
  return withCollection({ uri, database, collection, timeoutMs }, async (coll) => {
    const docs = await coll.find({ _id: { $in: idValues } }, { maxTimeMS: timeoutMs }).toArray();
    return docs.map((doc) => EJSON.serialize(doc, CANONICAL));
  });
}

function pendingFile(pendingDir, toolUseId) {
  return path.join(pendingDir, `${String(toolUseId).replace(/[^\w-]/g, '_')}.json`);
}

export function savePending(pendingDir, toolUseId, data) {
  fs.writeFileSync(pendingFile(pendingDir, toolUseId), JSON.stringify(data), { mode: 0o600 });
}

export function takePending(pendingDir, toolUseId) {
  const file = pendingFile(pendingDir, toolUseId);
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.rmSync(file, { force: true });
    return data;
  } catch {
    return null;
  }
}

/** Calls that were denied never reach PostToolUse; drop their snapshots after a while. */
export function prunePending(pendingDir, maxAgeMs = 60 * 60 * 1000, now = Date.now()) {
  for (const name of fs.existsSync(pendingDir) ? fs.readdirSync(pendingDir) : []) {
    const file = path.join(pendingDir, name);
    try {
      if (now - fs.statSync(file).mtimeMs > maxAgeMs) fs.rmSync(file, { force: true });
    } catch {
      // Already gone.
    }
  }
}
