import type { MouseEvent } from 'react';

/**
 * Click handler for a collapsible row. The caret button inside the row stays focusable for the
 * keyboard; its click bubbles up here. A click that ends a drag-selection is ignored so that
 * copying a value doesn't collapse the row.
 */
export function rowToggle(toggle: () => void, selection: () => string = () => window.getSelection()?.toString() ?? '') {
  return (_event: MouseEvent) => {
    if (selection()) return;
    toggle();
  };
}
