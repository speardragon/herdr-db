import { useCallback, useEffect, useState } from 'react';
import { clearEvents, useCapturedEvent, useEventFeed, type AddedMessage, type ConfigMessage } from './lib/api';
import { activateWindow, isNativeApp, quitNativeApp, revealWindow } from './lib/native';
import { useUnseenTitle } from './lib/title';
import { EventView } from './components/EventView';
import { LeafIcon } from './components/icons';
import { SettingsView } from './components/SettingsView';
import { Sidebar, type SidebarFilters } from './components/Sidebar';

const FOLLOW_KEY = 'herdr-db.follow';

type View = 'events' | 'settings';

function readFollow() {
  try {
    return localStorage.getItem(FOLLOW_KEY) !== 'false';
  } catch {
    return true;
  }
}

const viewFromHash = (): View => (window.location.hash === '#settings' ? 'settings' : 'events');

function EmptyState({ connected }: { connected: boolean }) {
  return (
    <div className="empty">
      <LeafIcon size={32} style={{ color: 'var(--accent-strong)' }} />
      <h2>{connected ? 'MongoDB MCP 호출을 기다리는 중' : '서버에 연결하는 중…'}</h2>
      <p>Claude Code가 mongodb MCP 도구(find, aggregate, update-many …)를 호출하면 읽은 문서, 쿼리 결과, 쓰기 diff가 여기에 Compass처럼 표시됩니다.</p>
    </div>
  );
}

/** `#settings` routing, shared by the gear button, the menu-bar item and `open.mjs --settings`. */
function useView() {
  const [view, setViewState] = useState<View>(viewFromHash);
  const setView = useCallback((next: View) => {
    setViewState(next);
    const hash = next === 'settings' ? '#settings' : '';
    if (window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
  }, []);

  useEffect(() => {
    const onHash = () => setViewState(viewFromHash());
    const onNative = (event: Event) => setView((event as CustomEvent<string>).detail === 'settings' ? 'settings' : 'events');
    window.addEventListener('hashchange', onHash);
    window.addEventListener('herdrdb:navigate', onNative);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('herdrdb:navigate', onNative);
    };
  }, [setView]);

  return [view, setView] as const;
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [follow, setFollow] = useState(readFollow);
  const [filters, setFilters] = useState<SidebarFilters>({ kind: 'all', query: '' });
  const [view, setView] = useView();
  const noteUnseen = useUnseenTitle(!isNativeApp());

  const onAdded = useCallback(
    ({ summary, reveal }: AddedMessage) => {
      setFreshId(summary.id);
      noteUnseen();
      if (follow) setSelectedId(summary.id);
      if (reveal) revealWindow(`${summary.tool} ${summary.namespace.collection ?? ''}`.trim());
    },
    [follow, noteUnseen],
  );

  const onConfig = useCallback(({ effectiveViewer }: ConfigMessage) => {
    if (isNativeApp() && effectiveViewer === 'browser') quitNativeApp();
  }, []);

  const onNavigate = useCallback(
    (next: string) => {
      setView(next === 'settings' ? 'settings' : 'events');
      activateWindow();
    },
    [setView],
  );

  const { events, connected } = useEventFeed({ onAdded, onConfig, onNavigate });
  const { event, error } = useCapturedEvent(selectedId);

  useEffect(() => {
    if (!selectedId && events.length) setSelectedId(events[0].id);
  }, [events, selectedId]);

  useEffect(() => {
    try {
      localStorage.setItem(FOLLOW_KEY, String(follow));
    } catch {
      // Storage can be unavailable; following is only a convenience.
    }
  }, [follow]);

  const onClear = async () => {
    if (!window.confirm('캡처된 모든 호출 기록을 삭제할까요?')) return;
    await clearEvents().catch(() => undefined);
    setSelectedId(null);
  };

  const onSelect = (id: string) => {
    setSelectedId(id);
    setView('events');
  };

  const main =
    view === 'settings' ? (
      <SettingsView onClose={() => setView('events')} />
    ) : event ? (
      <EventView key={event.id} event={event} />
    ) : error ? (
      <div className="empty">{error}</div>
    ) : (
      <EmptyState connected={connected} />
    );

  return (
    <div className="app">
      <Sidebar
        events={events}
        selectedId={view === 'events' ? selectedId : null}
        freshId={freshId}
        filters={filters}
        follow={follow}
        connected={connected}
        onSelect={onSelect}
        onFilters={setFilters}
        onFollow={setFollow}
        onClear={onClear}
        onSettings={() => setView(view === 'settings' ? 'events' : 'settings')}
      />
      <main className="main">{main}</main>
    </div>
  );
}
