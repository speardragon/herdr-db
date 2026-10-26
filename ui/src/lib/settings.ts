import type { LocalePreference } from './i18n';
import type { AgentId } from './types';

export type ViewerMode = 'app' | 'browser';
export type AutoOpen = 'always' | 'writes' | 'never';

export interface Settings {
  viewer: ViewerMode;
  autoOpen: AutoOpen;
  locale: LocalePreference;
  snapshotLimit: number;
  maxEvents: number;
  maxAgeDays: number;
}

export interface AgentHookStatus {
  label: string;
  detected: boolean;
  file: string;
  events: string[];
  nodePathMissing: boolean;
}

export interface SettingsStatus {
  port: number;
  home: string;
  hooks: Record<AgentId, AgentHookStatus>;
  appBuilt: boolean;
  effectiveViewer: ViewerMode;
  events: number;
  viewers: { app: number; browser: number };
}

export interface SettingsSnapshot {
  settings: Settings;
  status: SettingsStatus;
}

async function request(init?: RequestInit): Promise<SettingsSnapshot> {
  const res = await fetch('/api/settings', init);
  const body = (await res.json()) as SettingsSnapshot & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `settings request failed: ${res.status}`);
  return body;
}

export function getSettings() {
  return request();
}

export function saveSettings(patch: Partial<Settings>) {
  return request({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
}
