import fs from 'node:fs';
import path from 'node:path';
import { summarize } from './normalize.mjs';

const EVENT_FILE = /^[0-9a-z]+-[0-9a-f]+\.json$/;

export function eventIdFromFile(name) {
  return EVENT_FILE.test(name) ? name.slice(0, -'.json'.length) : null;
}

export function writeEvent(eventsDir, event) {
  const file = path.join(eventsDir, `${event.id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(event), { mode: 0o600 });
  fs.renameSync(tmp, file);
  return file;
}

export function readEvent(eventsDir, id) {
  if (!/^[0-9a-z]+-[0-9a-f]+$/.test(String(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(eventsDir, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export function listEventIds(eventsDir) {
  if (!fs.existsSync(eventsDir)) return [];
  return fs
    .readdirSync(eventsDir)
    .map(eventIdFromFile)
    .filter(Boolean)
    .sort()
    .reverse();
}

export function listSummaries(eventsDir) {
  return listEventIds(eventsDir)
    .map((id) => readEvent(eventsDir, id))
    .filter(Boolean)
    .map(summarize);
}

/** Keeps the newest `maxEvents` events that are younger than `maxAgeDays`. */
export function pruneEvents(eventsDir, { maxEvents, maxAgeDays }, now = Date.now()) {
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  const ids = listEventIds(eventsDir);
  const removed = ids.filter((id, index) => {
    const ts = parseInt(id.split('-')[0], 36);
    return index >= maxEvents || ts < cutoff;
  });
  for (const id of removed) fs.rmSync(path.join(eventsDir, `${id}.json`), { force: true });
  return removed;
}

export function clearEvents(eventsDir) {
  const ids = listEventIds(eventsDir);
  for (const id of ids) fs.rmSync(path.join(eventsDir, `${id}.json`), { force: true });
  return ids.length;
}
