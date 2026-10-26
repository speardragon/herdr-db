export interface SidebarLayout {
  width: number;
  collapsed: boolean;
}

export const SIDEBAR = { min: 240, max: 520, step: 16, rail: 40 } as const;

export const DEFAULT_LAYOUT: SidebarLayout = { width: 300, collapsed: false };

const STORAGE_KEY = 'herdr-db.sidebar';

const clamp = (width: number) => Math.round(Math.min(SIDEBAR.max, Math.max(SIDEBAR.min, width)));

/**
 * Layout for a drag that puts the sidebar's edge at `x`. Narrower than the min width folds it,
 * remembering `openWidth` so it reopens at the size it had.
 */
export function layoutFromDrag(x: number, openWidth: number = DEFAULT_LAYOUT.width): SidebarLayout {
  if (x < SIDEBAR.min) return { width: clamp(openWidth), collapsed: true };
  return { width: clamp(x), collapsed: false };
}

/** Keyboard control for the resize handle: arrows resize, Home/End jump to the limits, Enter folds. */
export function layoutFromKey(layout: SidebarLayout, key: string): SidebarLayout {
  switch (key) {
    case 'ArrowLeft':
      if (layout.collapsed) return layout;
      return layout.width <= SIDEBAR.min ? { ...layout, collapsed: true } : { ...layout, width: clamp(layout.width - SIDEBAR.step) };
    case 'ArrowRight':
      return layout.collapsed ? { ...layout, collapsed: false } : { ...layout, width: clamp(layout.width + SIDEBAR.step) };
    case 'Home':
      return { width: SIDEBAR.min, collapsed: false };
    case 'End':
      return { width: SIDEBAR.max, collapsed: false };
    case 'Enter':
      return { ...layout, collapsed: !layout.collapsed };
    default:
      return layout;
  }
}

export function parseLayout(text: string | null): SidebarLayout {
  try {
    const value = JSON.parse(text ?? '') as Partial<SidebarLayout>;
    const width = typeof value.width === 'number' && Number.isFinite(value.width) ? clamp(value.width) : DEFAULT_LAYOUT.width;
    return { width, collapsed: value.collapsed === true };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function readLayout(): SidebarLayout {
  try {
    return parseLayout(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: SidebarLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage can be unavailable; the size is only a convenience.
  }
}
