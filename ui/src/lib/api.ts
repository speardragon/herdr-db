import { useEffect, useRef, useState } from 'react';
import { clientKind } from './native';
import type { Settings, ViewerMode } from './settings';
import type { CapturedEvent, EventSummary } from './types';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${url} failed: ${res.status}`);
  return (await res.json()) as T;
}

export function clearEvents() {
  return getJson<{ removed: number }>('/api/events', { method: 'DELETE' });
}

export interface AddedMessage {
  summary: EventSummary;
  reveal: boolean;
}

export interface ConfigMessage {
  settings: Settings;
  effectiveViewer: ViewerMode;
}

export interface FeedHandlers {
  onAdded: (message: AddedMessage) => void;
  onConfig: (message: ConfigMessage) => void;
  onNavigate: (view: string) => void;
}

function parse<T>(message: Event): T {
  return JSON.parse((message as MessageEvent).data) as T;
}

/** Event summaries, kept live through the server-sent event stream. */
export function useEventFeed(handlers: FeedHandlers) {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getJson<{ events: EventSummary[] }>('/api/events')
        .then((data) => !cancelled && setEvents(data.events))
        .catch(() => !cancelled && setConnected(false));

    const source = new EventSource(`/api/stream?client=${clientKind()}`);
    source.onopen = () => {
      setConnected(true);
      load();
    };
    source.onerror = () => setConnected(false);
    let boot: string | null = null;
    source.addEventListener('hello', (message) => {
      const next = parse<{ boot: string }>(message).boot;
      if (boot && boot !== next) window.location.reload();
      boot = next;
    });
    source.addEventListener('added', (message) => {
      const data = parse<AddedMessage>(message);
      setEvents((current) => (current.some((e) => e.id === data.summary.id) ? current : [data.summary, ...current]));
      handlersRef.current.onAdded(data);
    });
    source.addEventListener('config', (message) => handlersRef.current.onConfig(parse<ConfigMessage>(message)));
    source.addEventListener('navigate', (message) => handlersRef.current.onNavigate(parse<{ view: string }>(message).view));
    source.addEventListener('removed', (message) => {
      const { id } = parse<{ id: string }>(message);
      setEvents((current) => current.filter((e) => e.id !== id));
    });
    source.addEventListener('cleared', () => setEvents([]));
    return () => {
      cancelled = true;
      source.close();
    };
  }, []);

  return { events, connected };
}

const cache = new Map<string, CapturedEvent>();

export function useCapturedEvent(id: string | null) {
  const [state, setState] = useState<{ event: CapturedEvent | null; error: string | null }>({ event: null, error: null });

  useEffect(() => {
    if (!id) {
      setState({ event: null, error: null });
      return;
    }
    const cached = cache.get(id);
    if (cached) {
      setState({ event: cached, error: null });
      return;
    }
    let cancelled = false;
    getJson<CapturedEvent>(`/api/events/${id}`)
      .then((event) => {
        cache.set(id, event);
        if (!cancelled) setState({ event, error: null });
      })
      .catch((error: Error) => !cancelled && setState({ event: null, error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
