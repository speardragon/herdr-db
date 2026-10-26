import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useT } from '../lib/i18n';
import { DEFAULT_LAYOUT, SIDEBAR, layoutFromDrag, layoutFromKey, readLayout, saveLayout, type SidebarLayout } from '../lib/sidebar-layout';

/** Sidebar width and folded state, remembered per viewer. */
export function useSidebarLayout(): [SidebarLayout, (layout: SidebarLayout) => void] {
  const [layout, setLayout] = useState<SidebarLayout>(readLayout);
  useEffect(() => saveLayout(layout), [layout]);
  return [layout, setLayout];
}

/**
 * The draggable edge between the sidebar and the main area. Dragging past the min width folds the
 * sidebar to a rail; dragging back out reopens it. Double-click restores the default width.
 */
export function SidebarResizer({ layout, onChange }: { layout: SidebarLayout; onChange: (layout: SidebarLayout) => void }) {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  // Read by pointermove right away, before the re-render that `dragging` triggers.
  const draggingRef = useRef(false);

  useEffect(() => {
    document.body.classList.toggle('is-resizing-sidebar', dragging);
    return () => document.body.classList.remove('is-resizing-sidebar');
  }, [dragging]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Without capture the drag still works while the pointer stays over the handle.
    }
    draggingRef.current = true;
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) onChange(layoutFromDrag(event.clientX, layout.width));
  };
  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    draggingRef.current = false;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = layoutFromKey(layout, event.key);
    if (next === layout) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      className={`sidebar-resizer${dragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t.sidebar.resize}
      aria-valuemin={SIDEBAR.min}
      aria-valuemax={SIDEBAR.max}
      aria-valuenow={layout.collapsed ? SIDEBAR.rail : layout.width}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onChange(DEFAULT_LAYOUT)}
      onKeyDown={onKeyDown}
    />
  );
}
