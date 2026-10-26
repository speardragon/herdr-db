import { useMemo } from 'react';
import { useT, type Messages } from '../lib/i18n';
import { agentLabel, type EventSummary } from '../lib/types';
import { AgentLogo } from './AgentLogo';
import { KindBadge } from './EventView';
import { GearIcon, LeafIcon, SidebarIcon, TrashIcon } from './icons';

export type KindFilter = 'all' | 'read' | 'write';

export interface SidebarFilters {
  kind: KindFilter;
  query: string;
}

const RESULT_WORD: Record<string, keyof Messages['summary']> = {
  find: 'docs',
  aggregate: 'results',
  'aggregate-db': 'results',
  'update-many': 'modified',
  'delete-many': 'deleted',
  'insert-many': 'inserted',
};

export function formatClock(ts: string) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
}

function resultText(event: EventSummary, t: Messages) {
  if (event.status === 'error') return t.summary.failed;
  if (event.tool === 'count' && event.count != null) return t.summary.count(event.count.toLocaleString());
  const word = RESULT_WORD[event.tool];
  if (!word || word === 'failed' || event.count == null) return null;
  const total = event.total != null && event.total > event.count ? ` / ${event.total.toLocaleString()}` : '';
  return t.summary[word](`${event.count.toLocaleString()}${total}`);
}

function dayLabel(ts: string, t: Messages) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return t.sidebar.today;
  if (date.toDateString() === yesterday.toDateString()) return t.sidebar.yesterday;
  return date.toLocaleDateString(t.dateLocale, { month: 'long', day: 'numeric', weekday: 'short' });
}

function matches(event: EventSummary, filters: SidebarFilters) {
  if (filters.kind === 'read' && !(event.kind === 'read' || event.kind === 'meta')) return false;
  if (filters.kind === 'write' && !(event.kind === 'write' || event.kind === 'admin')) return false;
  const q = filters.query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [agentLabel(event.agent), event.server, event.tool, event.namespace.database, event.namespace.collection, event.project, event.herdr?.workspaceLabel, event.herdr?.tabLabel, event.herdr?.paneTitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function groupByDay(events: EventSummary[], t: Messages) {
  return events.reduce<Array<{ label: string; items: EventSummary[] }>>((groups, event) => {
    const label = dayLabel(event.ts, t);
    const last = groups.at(-1);
    if (last && last.label === label) return [...groups.slice(0, -1), { label, items: [...last.items, event] }];
    return [...groups, { label, items: [event] }];
  }, []);
}

function EventItem({ event, selected, fresh, onSelect }: { event: EventSummary; selected: boolean; fresh: boolean; onSelect: () => void }) {
  const t = useT();
  const { database, collection } = event.namespace;
  const where = event.herdr?.tabLabel || event.herdr?.workspaceLabel || event.project;
  const meta = [resultText(event, t), collection ? database : event.server, where].filter(Boolean);
  return (
    <li>
      <button type="button" className={`event-item${fresh ? ' fresh' : ''}`} aria-current={selected} onClick={onSelect}>
        <KindBadge kind={event.kind} status={event.status} />
        <span className="event-ns" title={[database, collection].filter(Boolean).join('.')}>
          <span className="event-tool">{event.tool}</span> {collection ?? database ?? event.server}
        </span>
        <span className="event-time">{formatClock(event.ts)}</span>
        <span className="event-meta">
          <AgentLogo agent={event.agent} size={12} title />
          {meta.map((part, index) => (
            <span key={index}>
              {index > 0 && <span className="sep">· </span>}
              {part}
            </span>
          ))}
        </span>
      </button>
    </li>
  );
}

interface Props {
  events: EventSummary[];
  selectedId: string | null;
  freshId: string | null;
  filters: SidebarFilters;
  follow: boolean;
  connected: boolean;
  onSelect: (id: string) => void;
  onFilters: (filters: SidebarFilters) => void;
  onFollow: (follow: boolean) => void;
  onClear: () => void;
  onSettings: () => void;
  onCollapse: () => void;
}

export function Sidebar({ events, selectedId, freshId, filters, follow, connected, onSelect, onFilters, onFollow, onClear, onSettings, onCollapse }: Props) {
  const t = useT();
  const groups = useMemo(() => groupByDay(events.filter((event) => matches(event, filters)), t), [events, filters, t]);
  const kinds: Array<[KindFilter, string]> = [
    ['all', t.sidebar.all],
    ['read', t.sidebar.reads],
    ['write', t.sidebar.writes],
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand">
          <span className="brand-mark">
            <LeafIcon size={14} />
          </span>
          Herdr DB
          <span className={`badge ${connected ? 'badge-ok' : 'badge-admin'}`} title={connected ? t.sidebar.live : t.sidebar.offline}>
            {connected ? 'live' : 'offline'}
          </span>
          <div className="brand-actions">
            <button type="button" className="icon-button" title={t.sidebar.collapse} aria-label={t.sidebar.collapse} onClick={onCollapse}>
              <SidebarIcon open />
            </button>
            <button type="button" className="icon-button" title={t.sidebar.settings} aria-label={t.sidebar.settings} onClick={onSettings}>
              <GearIcon />
            </button>
            <button type="button" className="icon-button" title={t.sidebar.clear} aria-label={t.sidebar.clear} onClick={onClear}>
              <TrashIcon />
            </button>
          </div>
        </div>
        <input
          className="search"
          type="search"
          placeholder={t.sidebar.search}
          value={filters.query}
          onChange={(e) => onFilters({ ...filters, query: e.target.value })}
        />
        <div className="segmented" role="group" aria-label={t.sidebar.kind}>
          {kinds.map(([kind, label]) => (
            <button key={kind} type="button" aria-pressed={filters.kind === kind} onClick={() => onFilters({ ...filters, kind })}>
              {label}
            </button>
          ))}
        </div>
        <label className="follow">
          <input type="checkbox" checked={follow} onChange={(e) => onFollow(e.target.checked)} />
          {t.sidebar.follow}
        </label>
      </div>
      <ul className="event-list">
        {groups.map((group) => (
          <li key={group.label}>
            <div className="group-label">{group.label}</div>
            <ul className="event-list" style={{ padding: 0 }}>
              {group.items.map((event) => (
                <EventItem key={event.id} event={event} selected={event.id === selectedId} fresh={event.id === freshId} onSelect={() => onSelect(event.id)} />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}
