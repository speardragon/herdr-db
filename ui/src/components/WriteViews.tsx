import { useMemo, useState } from 'react';
import { fromEJSON } from '../lib/bson';
import { pairDocuments, type DocumentChange } from '../lib/diff';
import { useT, type Messages } from '../lib/i18n';
import { agentLabel, type AgentId, type CapturedEvent, type Snapshot } from '../lib/types';
import { Banner, StatCards } from './Banner';
import { BsonValue } from './BsonValue';
import { ChangeView } from './ChangeView';
import { CopyButton, DocumentList, toRelaxedJson } from './DocumentList';
import { DocumentView } from './Document';
import { QueryBar, QueryRow } from './QueryBar';

const num = (value: unknown) => (typeof value === 'number' ? value : '–');

// Where each agent keeps its MCP server definitions.
const CONFIG_FILES: Record<AgentId, [string, string]> = {
  claude: ['~/.claude.json', '.mcp.json'],
  codex: ['~/.codex/config.toml', '.codex/config.toml'],
};

function ConfigFiles({ agent }: { agent: AgentId }) {
  const [first, second] = CONFIG_FILES[agent];
  return (
    <>
      <code>{first}</code> / <code>{second}</code>
    </>
  );
}

export function SnapshotNotice({ snapshot, server, agent = 'claude' }: { snapshot: Snapshot | null; server: string; agent?: AgentId }) {
  const t = useT();
  if (!snapshot) return null;
  const error = snapshot.error;
  if (error === 'connection-string-not-found') {
    const envName = `HERDR_DB_URI_${server.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
    return (
      <Banner variant="warn" title={t.snapshot.noConnectionTitle}>
        {t.snapshot.noConnection({
          server: <code>{server}</code>,
          files: <ConfigFiles agent={agent} />,
          key: <code>MDB_MCP_CONNECTION_STRING</code>,
          env: <code>{envName}</code>,
        })}
      </Banner>
    );
  }
  if (error === 'runtime-connection') return <Banner variant="warn" title={t.snapshot.runtimeConnection} />;
  if (error === 'no-before-snapshot') {
    return (
      <Banner variant="warn" title={t.snapshot.noBeforeTitle}>
        {t.snapshot.noBefore(agentLabel(agent))}
      </Banner>
    );
  }
  if (error) {
    return (
      <Banner variant="warn" title={snapshot.before ? t.snapshot.afterFailed : t.snapshot.failed}>
        <pre>{error}</pre>
      </Banner>
    );
  }
  if (snapshot.truncated) {
    return (
      <Banner variant="info" title={t.snapshot.truncated(snapshot.before?.length ?? 0)}>
        {t.snapshot.matched(snapshot.matched?.toLocaleString() ?? '?')}
      </Banner>
    );
  }
  return null;
}

function changeBadge(change: DocumentChange, t: Messages) {
  switch (change.kind) {
    case 'modified':
      return (
        <>
          <span className="badge badge-write">{t.write.badgeModified}</span>
          {change.stats.changed > 0 && <span className="stat stat-changed">~{change.stats.changed}</span>}
          {change.stats.added > 0 && <span className="stat stat-added">+{change.stats.added}</span>}
          {change.stats.removed > 0 && <span className="stat stat-removed">−{change.stats.removed}</span>}
        </>
      );
    case 'unchanged':
      return <span className="badge badge-meta">{t.write.badgeUnchanged}</span>;
    case 'inserted':
      return <span className="badge badge-ok">{t.write.badgeUpserted}</span>;
    case 'deleted':
      return <span className="badge badge-admin">{t.write.badgeGone}</span>;
  }
}

function ChangeCard({ change }: { change: DocumentChange }) {
  const t = useT();
  const doc = 'document' in change ? change.document : null;
  return (
    <div className={`document-card${change.kind === 'inserted' ? ' is-added' : change.kind === 'deleted' ? ' is-removed' : ''}`}>
      {doc !== null && (
        <div className="card-actions">
          <CopyButton text={() => toRelaxedJson(doc)} />
        </div>
      )}
      <div className="card-tag mono">
        <span className="element-key">_id:</span> <BsonValue value={change.id} />
        {changeBadge(change, t)}
      </div>
      {change.kind === 'modified' || change.kind === 'unchanged' ? (
        <ChangeView diff={change.diff} />
      ) : (
        <DocumentView doc={doc} tone={change.kind === 'inserted' ? 'added' : 'removed'} />
      )}
    </div>
  );
}

export function UpdateView({ event }: { event: CapturedEvent }) {
  const t = useT();
  const [showUnchanged, setShowUnchanged] = useState(false);
  const result = event.result ?? {};
  const snapshot = event.snapshot;
  const changes = useMemo(() => {
    if (!snapshot?.before || !snapshot.after) return null;
    return pairDocuments(snapshot.before.map((d) => fromEJSON(d)), snapshot.after.map((d) => fromEJSON(d)));
  }, [snapshot]);
  const unchanged = changes?.filter((change) => change.kind === 'unchanged').length ?? 0;
  const visible = changes?.filter((change) => showUnchanged || change.kind !== 'unchanged') ?? [];

  return (
    <>
      <StatCards
        items={[
          { label: t.write.matched, value: num(result.matchedCount) },
          { label: t.write.modified, value: num(result.modifiedCount) },
          { label: t.write.upserted, value: num(result.upsertedCount) },
        ]}
      />
      <QueryBar input={event.input}>
        <QueryRow label="Update" value={event.input.update} />
      </QueryBar>
      <SnapshotNotice snapshot={snapshot} server={event.server} agent={event.agent} />
      {changes && (
        <section className="document-list" aria-label={t.write.changes}>
          <div className="toolbar">
            <strong>{t.write.changes}</strong>
            <span>{t.write.changedOf(changes.length - unchanged, changes.length)}</span>
            <span className="spacer" />
            {unchanged > 0 && (
              <button type="button" className="text-button" aria-pressed={showUnchanged} onClick={() => setShowUnchanged(!showUnchanged)}>
                {t.write.showUnchanged(unchanged)}
              </button>
            )}
          </div>
          {visible.map((change, index) => (
            <ChangeCard key={index} change={change} />
          ))}
        </section>
      )}
    </>
  );
}

export function DeleteView({ event }: { event: CapturedEvent }) {
  const t = useT();
  const snapshot = event.snapshot;
  return (
    <>
      <StatCards items={[{ label: t.write.deleted, value: num(event.result?.deletedCount) }]} />
      <QueryBar input={event.input} />
      <SnapshotNotice snapshot={snapshot} server={event.server} agent={event.agent} />
      {snapshot?.before && <DocumentList title={t.write.deletedDocuments} documents={snapshot.before} total={snapshot.matched} tone="removed" />}
    </>
  );
}

function withInsertedIds(documents: unknown[], insertedIds: unknown): unknown[] {
  const ids = Array.isArray(insertedIds) ? insertedIds : [];
  return documents.map((doc, index) => {
    if (!doc || typeof doc !== 'object' || '_id' in doc || ids[index] === undefined) return doc;
    const id = ids[index];
    const _id = typeof id === 'string' && /^[0-9a-f]{24}$/.test(id) ? { $oid: id } : id;
    return { _id, ...doc };
  });
}

export function InsertView({ event }: { event: CapturedEvent }) {
  const t = useT();
  const documents = Array.isArray(event.input.documents) ? event.input.documents : [];
  const inserted = withInsertedIds(documents, event.result?.insertedIds);
  return (
    <>
      <StatCards items={[{ label: t.write.inserted, value: num(event.result?.insertedCount) }]} />
      <DocumentList title={t.write.insertedDocuments} documents={inserted} tone="added" />
    </>
  );
}
