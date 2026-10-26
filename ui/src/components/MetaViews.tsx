import { ShellText } from './Highlight';
import { useT } from '../lib/i18n';
import type { CapturedEvent } from '../lib/types';
import { Banner } from './Banner';
import { DocumentList } from './DocumentList';

function formatBytes(bytes: unknown) {
  if (typeof bytes !== 'number') return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent ? 1 : 0)} ${units[exponent]}`;
}

function NameGrid({ title, items }: { title: string; items: Array<{ name: string; sub?: string | null }> }) {
  return (
    <section className="document-list">
      <div className="toolbar">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <div className="name-grid">
        {items.map((item) => (
          <div className="name-card" key={item.name}>
            <span>{item.name}</span>
            {item.sub && <span className="sub">{item.sub}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

type Named = { name?: string; sizeOnDisk?: number; type?: string };

function listOf(result: Record<string, unknown> | null, key: string): Named[] {
  const value = result?.[key];
  return Array.isArray(value) ? (value as Named[]) : [];
}

function IndexesView({ event }: { event: CapturedEvent }) {
  const t = useT();
  const indexes = listOf(event.result, 'classicIndexes').length ? listOf(event.result, 'classicIndexes') : listOf(event.result, 'indexes');
  if (!indexes.length) return <GenericResult event={event} />;
  return (
    <section className="document-list">
      <div className="toolbar">
        <strong>{t.event.indexes}</strong>
        <span>{indexes.length}</span>
      </div>
      {indexes.map((index, i) => (
        <div className="name-card" key={index.name ?? i}>
          <span>{index.name}</span>
          <span className="sub"><ShellText value={(index as { key?: unknown }).key ?? {}} /></span>
        </div>
      ))}
    </section>
  );
}

function GenericResult({ event }: { event: CapturedEvent }) {
  const t = useT();
  if (event.result && typeof event.result === 'object') return <DocumentList title={t.event.result} documents={[event.result]} />;
  if (event.resultText) return <Banner variant="info" title={t.event.result}><pre>{event.resultText}</pre></Banner>;
  return <Banner variant="info" title={t.event.emptyResult} />;
}

export function MetaView({ event }: { event: CapturedEvent }) {
  const t = useT();
  switch (event.tool) {
    case 'list-databases':
      return <NameGrid title={t.event.databases} items={listOf(event.result, 'databases').map((db) => ({ name: String(db.name), sub: formatBytes(db.sizeOnDisk) }))} />;
    case 'list-collections':
      return <NameGrid title={t.event.collections} items={listOf(event.result, 'collections').map((c) => ({ name: String(c.name), sub: c.type && c.type !== 'collection' ? c.type : null }))} />;
    case 'collection-indexes':
      return <IndexesView event={event} />;
    default:
      return <GenericResult event={event} />;
  }
}

export function AdminView({ event }: { event: CapturedEvent }) {
  const t = useT();
  return (
    <>
      <Banner variant={event.tool.startsWith('drop') ? 'danger' : 'info'} title={event.tool}>
        {event.resultText ?? null}
      </Banner>
      <DocumentList title={t.event.input} documents={[event.input]} />
      {event.result && <DocumentList title={t.event.result} documents={[event.result]} />}
    </>
  );
}
