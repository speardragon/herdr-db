import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, SIDEBAR, layoutFromDrag, layoutFromKey, parseLayout } from './sidebar-layout';

describe('sidebar layout', () => {
  it('follows the pointer between the min and max width', () => {
    expect(layoutFromDrag(360)).toEqual({ width: 360, collapsed: false });
    expect(layoutFromDrag(SIDEBAR.max + 200)).toEqual({ width: SIDEBAR.max, collapsed: false });
    expect(layoutFromDrag(SIDEBAR.min)).toEqual({ width: SIDEBAR.min, collapsed: false });
  });

  it('collapses once dragged narrower than the min width, keeping the last open width', () => {
    expect(layoutFromDrag(SIDEBAR.min - 1, 410)).toEqual({ width: 410, collapsed: true });
    expect(layoutFromDrag(0)).toEqual({ width: DEFAULT_LAYOUT.width, collapsed: true });
  });

  it('resizes from the keyboard and folds below the min width', () => {
    const open = { width: 300, collapsed: false };
    expect(layoutFromKey(open, 'ArrowRight')).toEqual({ width: 300 + SIDEBAR.step, collapsed: false });
    expect(layoutFromKey(open, 'ArrowLeft')).toEqual({ width: 300 - SIDEBAR.step, collapsed: false });
    expect(layoutFromKey({ width: SIDEBAR.min, collapsed: false }, 'ArrowLeft')).toEqual({ width: SIDEBAR.min, collapsed: true });
    expect(layoutFromKey({ width: 410, collapsed: true }, 'ArrowRight')).toEqual({ width: 410, collapsed: false });
    expect(layoutFromKey(open, 'Enter')).toEqual({ width: 300, collapsed: true });
    expect(layoutFromKey(open, 'Home')).toEqual({ width: SIDEBAR.min, collapsed: false });
    expect(layoutFromKey(open, 'End')).toEqual({ width: SIDEBAR.max, collapsed: false });
    expect(layoutFromKey(open, 'a')).toBe(open);
  });

  it('reads a stored layout defensively', () => {
    expect(parseLayout(JSON.stringify({ width: 400, collapsed: true }))).toEqual({ width: 400, collapsed: true });
    expect(parseLayout(JSON.stringify({ width: 9999, collapsed: 'yes' }))).toEqual({ width: SIDEBAR.max, collapsed: false });
    expect(parseLayout('not json')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout(null)).toEqual(DEFAULT_LAYOUT);
  });
});
