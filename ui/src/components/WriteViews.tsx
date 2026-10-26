import { useMemo, useState } from 'react';
import { fromEJSON } from '../lib/bson';
import { pairDocuments, type DocumentChange } from '../lib/diff';
import type { CapturedEvent, Snapshot } from '../lib/types';
import { Banner, StatCards } from './Banner';
import { BsonValue } from './BsonValue';
import { ChangeView } from './ChangeView';
import { CopyButton, DocumentList, toRelaxedJson } from './DocumentList';
import { DocumentView } from './Document';
import { QueryBar, QueryRow } from './QueryBar';

const num = (value: unknown) => (typeof value === 'number' ? value : '–');

export function SnapshotNotice({ snapshot, server }: { snapshot: Snapshot | null; server: string }) {
  if (!snapshot) return null;
  const error = snapshot.error;
  if (error === 'connection-string-not-found') {
    const envName = `HERDR_DB_URI_${server.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
    return (
      <Banner variant="warn" title="변경 전 문서를 캡처하지 못했습니다">
        <code>{server}</code> MCP 서버의 연결 문자열을 찾지 못했습니다. <code>~/.claude.json</code> / <code>.mcp.json</code>의{' '}
        <code>MDB_MCP_CONNECTION_STRING</code>을 확인하거나 <code>{envName}</code> 환경 변수를 지정하세요.
      </Banner>
    );
  }
  if (error === 'runtime-connection') {
    return <Banner variant="warn" title="런타임 연결(connect 도구)로 실행된 쓰기라 변경 전 문서를 캡처할 수 없습니다" />;
  }
  if (error === 'no-before-snapshot') {
    return <Banner variant="warn" title="PreToolUse 훅이 실행되지 않아 변경 전 문서가 없습니다">훅 설치 직후라면 Claude Code 세션을 다시 시작하세요.</Banner>;
  }
  if (error) {
    return (
      <Banner variant="warn" title={snapshot.before ? '변경 후 문서를 다시 읽지 못했습니다' : '스냅샷 캡처 실패'}>
        <pre>{error}</pre>
      </Banner>
    );
  }
  if (snapshot.truncated) {
    return (
      <Banner variant="info" title={`스냅샷은 처음 ${snapshot.before?.length ?? 0}개 문서만 담고 있습니다`}>
        필터와 일치한 문서는 {snapshot.matched ?? '?'}개입니다.
      </Banner>
    );
  }
  return null;
}

function changeBadge(change: DocumentChange) {
  switch (change.kind) {
    case 'modified':
      return (
        <>
          <span className="badge badge-write">modified</span>
          {change.stats.changed > 0 && <span className="stat stat-changed">~{change.stats.changed}</span>}
          {change.stats.added > 0 && <span className="stat stat-added">+{change.stats.added}</span>}
          {change.stats.removed > 0 && <span className="stat stat-removed">−{change.stats.removed}</span>}
        </>
      );
    case 'unchanged':
      return <span className="badge badge-meta">no change</span>;
    case 'inserted':
      return <span className="badge badge-ok">upserted</span>;
    case 'deleted':
      return <span className="badge badge-admin">no longer exists</span>;
  }
}

function ChangeCard({ change }: { change: DocumentChange }) {
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
        {changeBadge(change)}
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
          { label: 'Matched', value: num(result.matchedCount) },
          { label: 'Modified', value: num(result.modifiedCount) },
          { label: 'Upserted', value: num(result.upsertedCount) },
        ]}
      />
      <QueryBar input={event.input}>
        <QueryRow label="Update" value={event.input.update} />
      </QueryBar>
      <SnapshotNotice snapshot={snapshot} server={event.server} />
      {changes && (
        <section className="document-list" aria-label="Changes">
          <div className="toolbar">
            <strong>Changes</strong>
            <span>{changes.length - unchanged} of {changes.length} captured documents changed</span>
            <span className="spacer" />
            {unchanged > 0 && (
              <button type="button" className="text-button" aria-pressed={showUnchanged} onClick={() => setShowUnchanged(!showUnchanged)}>
                Show {unchanged} unchanged
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
  const snapshot = event.snapshot;
  return (
    <>
      <StatCards items={[{ label: 'Deleted', value: num(event.result?.deletedCount) }]} />
      <QueryBar input={event.input} />
      <SnapshotNotice snapshot={snapshot} server={event.server} />
      {snapshot?.before && <DocumentList title="Deleted documents" documents={snapshot.before} total={snapshot.matched} tone="removed" />}
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
  const documents = Array.isArray(event.input.documents) ? event.input.documents : [];
  const inserted = withInsertedIds(documents, event.result?.insertedIds);
  return (
    <>
      <StatCards items={[{ label: 'Inserted', value: num(event.result?.insertedCount) }]} />
      <DocumentList title="Inserted documents" documents={inserted} tone="added" />
    </>
  );
}
