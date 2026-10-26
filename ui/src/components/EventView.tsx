import { useT } from '../lib/i18n';
import { agentLabel, type CapturedEvent, type EventKind } from '../lib/types';
import { AgentLogo } from './AgentLogo';
import { Banner } from './Banner';
import { DocumentList } from './DocumentList';
import { AdminView, MetaView } from './MetaViews';
import { AggregateView, CountView, ExportView, FindView } from './ReadViews';
import { SessionBar } from './SessionBar';
import { DeleteView, InsertView, UpdateView } from './WriteViews';

export function KindBadge({ kind, status }: { kind: EventKind; status?: 'ok' | 'error' }) {
  if (status === 'error') return <span className="badge badge-error">error</span>;
  return <span className={`badge badge-${kind ?? 'meta'}`}>{kind ?? 'call'}</span>;
}

function formatTime(ts: string) {
  const date = new Date(ts);
  const day = date.toLocaleDateString('sv-SE');
  return `${day} ${date.toLocaleTimeString('en-GB', { hour12: false })}`;
}

function EventHeader({ event }: { event: CapturedEvent }) {
  const { database, collection } = event.namespace;
  return (
    <header className="event-header">
      <div className="breadcrumb">
        <span className="crumb-muted">{event.server}</span>
        {database && (
          <>
            <span className="chevron">›</span>
            <span className={collection ? 'crumb-muted' : undefined}>{database}</span>
          </>
        )}
        {collection && (
          <>
            <span className="chevron">›</span>
            <span>{collection}</span>
          </>
        )}
      </div>
      <div className="header-meta">
        <KindBadge kind={event.kind} status={event.status} />
        <span className="tool-chip">{event.tool}</span>
        <span className={`agent-chip agent-${event.agent ?? 'claude'}`}>
          <AgentLogo agent={event.agent} />
          {agentLabel(event.agent)}
        </span>
        <span>{formatTime(event.ts)}</span>
        {event.durationMs != null && <span>{event.durationMs} ms</span>}
      </div>
      <SessionBar event={event} />
    </header>
  );
}

function Body({ event }: { event: CapturedEvent }) {
  const t = useT();
  if (event.status === 'error') {
    return (
      <>
        <Banner variant="danger" title={t.event.failed}>
          <pre>{event.resultText}</pre>
        </Banner>
        <DocumentList title={t.event.input} documents={[event.input]} />
      </>
    );
  }
  switch (event.tool) {
    case 'find':
      return <FindView event={event} />;
    case 'aggregate':
    case 'aggregate-db':
      return <AggregateView event={event} />;
    case 'count':
      return <CountView event={event} />;
    case 'export':
      return <ExportView event={event} />;
    case 'update-many':
      return <UpdateView event={event} />;
    case 'delete-many':
      return <DeleteView event={event} />;
    case 'insert-many':
      return <InsertView event={event} />;
    default:
      return event.kind === 'admin' ? <AdminView event={event} /> : <MetaView event={event} />;
  }
}

export function EventView({ event }: { event: CapturedEvent }) {
  return (
    <>
      <EventHeader event={event} />
      <div className="content">
        <Body event={event} />
      </div>
    </>
  );
}
