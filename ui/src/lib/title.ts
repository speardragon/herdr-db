import { useCallback, useEffect, useRef } from 'react';

const BASE_TITLE = 'Herdr DB';

export function titleFor(unseen: number) {
  return unseen > 0 ? `(${unseen}) ${BASE_TITLE}` : BASE_TITLE;
}

/**
 * A browser tab cannot be brought forward, so new calls are counted in the tab title
 * while the tab is hidden. Returns a function to call for every new event.
 */
export function useUnseenTitle(enabled: boolean) {
  const unseen = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const reset = () => {
      if (document.visibilityState === 'visible') {
        unseen.current = 0;
        document.title = titleFor(0);
      }
    };
    document.addEventListener('visibilitychange', reset);
    return () => document.removeEventListener('visibilitychange', reset);
  }, [enabled]);

  return useCallback(() => {
    if (!enabled || document.visibilityState === 'visible') return;
    unseen.current += 1;
    document.title = titleFor(unseen.current);
  }, [enabled]);
}
