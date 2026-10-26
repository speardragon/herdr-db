import { useT } from '../lib/i18n';
import { GearIcon, LeafIcon, SidebarIcon } from './icons';

/** What's left of the sidebar when it's folded: the way back, settings and the connection state. */
export function SidebarRail({ connected, onExpand, onSettings }: { connected: boolean; onExpand: () => void; onSettings: () => void }) {
  const t = useT();
  const state = connected ? t.sidebar.live : t.sidebar.offline;
  return (
    <aside className="sidebar sidebar-rail">
      <span className="brand-mark" title={`Herdr DB · ${state}`}>
        <LeafIcon size={14} />
      </span>
      <span className={`rail-dot${connected ? ' is-live' : ''}`} role="img" aria-label={state} />
      <button type="button" className="icon-button" title={t.sidebar.expand} aria-label={t.sidebar.expand} onClick={onExpand}>
        <SidebarIcon open={false} />
      </button>
      <button type="button" className="icon-button" title={t.sidebar.settings} aria-label={t.sidebar.settings} onClick={onSettings}>
        <GearIcon />
      </button>
    </aside>
  );
}
