import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { clearEvents, useCapturedEvent, useEventFeed, type AddedMessage, type ConfigMessage } from './lib/api';
import { I18nContext, MESSAGES, resolveLocale, useT, type LocalePreference, type Messages } from './lib/i18n';
import { activateWindow, isNativeApp, quitNativeApp, revealWindow, setNativeMenu } from './lib/native';
import { getSettings } from './lib/settings';
import { SIDEBAR } from './lib/sidebar-layout';
import { useUnseenTitle } from './lib/title';
import { EventView } from './components/EventView';
import { LeafIcon } from './components/icons';
import { SettingsView } from './components/SettingsView';
import { Sidebar, type SidebarFilters } from './components/Sidebar';
import { SidebarRail } from './components/SidebarRail';
import { SidebarResizer, useSidebarLayout } from './components/SidebarResizer';

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
  const t = useT();
  return (
    <div className="empty">
      <LeafIcon size={32} style={{ color: 'var(--accent-strong)' }} />
      <h2>{connected ? t.empty.waiting : t.empty.connecting}</h2>
      <p>{t.empty.body}</p>
    </div>
  );
}

/** The language comes from the server's settings so the native window and browser tabs agree. */
function useLocale() {
  const [preference, setPreference] = useState<LocalePreference>('auto');
  useEffect(() => {
    getSettings()
      .then((snapshot) => setPreference(snapshot.settings.locale))
      .catch(() => undefined);
  }, []);
  const locale = resolveLocale(preference);
  const messages: Messages = MESSAGES[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
    setNativeMenu(messages.menu);
  }, [locale, messages]);
  return [messages, setPreference] as const;
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
  const [layout, setLayout] = useSidebarLayout();
  const [view, setView] = useView();
  const noteUnseen = useUnseenTitle(!isNativeApp());
  const [messages, setLocalePreference] = useLocale();

  const onAdded = useCallback(
    ({ summary, reveal }: AddedMessage) => {
      setFreshId(summary.id);
      noteUnseen();
      if (follow) setSelectedId(summary.id);
      if (reveal) revealWindow(`${summary.tool} ${summary.namespace.collection ?? ''}`.trim());
    },
    [follow, noteUnseen],
  );

  const onConfig = useCallback(
    ({ settings, effectiveViewer }: ConfigMessage) => {
      setLocalePreference(settings.locale);
      if (isNativeApp() && effectiveViewer === 'browser') quitNativeApp();
    },
    [setLocalePreference],
  );

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
    if (!window.confirm(messages.confirmClear)) return;
    await clearEvents().catch(() => undefined);
    setSelectedId(null);
  };

  const onSelect = (id: string) => {
    setSelectedId(id);
    setView('events');
  };

  const onSettings = () => setView(view === 'settings' ? 'events' : 'settings');
  const sidebarWidth = layout.collapsed ? SIDEBAR.rail : layout.width;

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
    <I18nContext.Provider value={messages}>
    <div className={`app${layout.collapsed ? ' is-sidebar-collapsed' : ''}`} style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
      {layout.collapsed ? (
        <SidebarRail connected={connected} onExpand={() => setLayout({ ...layout, collapsed: false })} onSettings={onSettings} />
      ) : (
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
          onSettings={onSettings}
          onCollapse={() => setLayout({ ...layout, collapsed: true })}
        />
      )}
      <SidebarResizer layout={layout} onChange={setLayout} />
      <main className="main">{main}</main>
    </div>
    </I18nContext.Provider>
  );
}
