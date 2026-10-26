import { useEffect, useState, type ReactNode } from 'react';
import { getSettings, saveSettings, type AgentHookStatus, type AutoOpen, type Settings, type SettingsSnapshot, type ViewerMode } from '../lib/settings';
import { useT, type LocalePreference, type Messages } from '../lib/i18n';
import type { AgentId } from '../lib/types';
import { AgentLogo } from './AgentLogo';
import { Banner } from './Banner';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string };

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="settings-section">
      <div>
        <h3 className="section-title">{title}</h3>
        {description && <p className="settings-help">{description}</p>}
      </div>
      <div className="settings-control">{children}</div>
    </section>
  );
}

function ViewerChoice({ value, appBuilt, onChange }: { value: ViewerMode; appBuilt: boolean; onChange: (mode: ViewerMode) => void }) {
  const t = useT();
  const options: Array<{ mode: ViewerMode; title: string; body: string; disabled?: boolean }> = [
    { mode: 'app', title: t.settings.appTitle, body: appBuilt ? t.settings.appBody : t.settings.appMissing, disabled: !appBuilt },
    { mode: 'browser', title: t.settings.browserTitle, body: t.settings.browserBody },
  ];
  return (
    <div className="choice-grid" role="radiogroup" aria-label={t.settings.viewer}>
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={value === option.mode}
          disabled={option.disabled}
          className="choice-card"
          onClick={() => onChange(option.mode)}
        >
          <strong>{option.title}</strong>
          <span>{option.body}</span>
        </button>
      ))}
    </div>
  );
}

function NumberField({ value, min, max, suffix, onCommit }: { value: number; min: number; max: number; suffix: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Math.round(Number(draft));
    const clamped = Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : value;
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="number-field">
      <input
        className="search"
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      <span>{suffix}</span>
    </label>
  );
}

function hookState(hooks: AgentHookStatus, t: Messages): string {
  if (hooks.events.length) return hooks.events.join(', ');
  return hooks.detected ? t.settings.notInstalled : t.settings.notFound;
}

type StatusRow = [key: string, label: ReactNode, value: ReactNode];

function StatusList({ status }: { status: SettingsSnapshot['status'] }) {
  const t = useT();
  const hookRows = (Object.entries(status.hooks) as Array<[AgentId, AgentHookStatus]>).map(([agent, hooks]): StatusRow => [
    `hooks-${agent}`,
    <span className="status-agent">
      <AgentLogo agent={agent} />
      {t.settings.hooks(hooks.label)}
    </span>,
    hookState(hooks, t),
  ]);
  const rows: StatusRow[] = [
    ...hookRows,
    ['server', t.settings.server, `http://127.0.0.1:${status.port}/`],
    ['viewers', t.settings.viewers, t.settings.viewersValue(status.viewers.app, status.viewers.browser)],
    ['stored', t.settings.stored, t.settings.storedValue(status.events, status.home)],
  ];
  return (
    <dl className="status-list">
      {rows.map(([key, label, value]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd className="mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([option, text]) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
          {text}
        </button>
      ))}
    </div>
  );
}

export function SettingsView({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null);
  const [save, setSave] = useState<SaveState>({ kind: 'idle' });

  useEffect(() => {
    getSettings()
      .then(setSnapshot)
      .catch((error: Error) => setSave({ kind: 'error', message: error.message }));
  }, []);

  const update = async (patch: Partial<Settings>) => {
    setSave({ kind: 'saving' });
    try {
      setSnapshot(await saveSettings(patch));
      setSave({ kind: 'saved' });
    } catch (error) {
      setSave({ kind: 'error', message: (error as Error).message });
    }
  };

  const autoOpenOptions: Array<[AutoOpen, string]> = [
    ['always', t.settings.always],
    ['writes', t.settings.writes],
    ['never', t.settings.never],
  ];
  // Language names are written in their own language so they can be found from either one.
  const localeOptions: Array<[LocalePreference, string]> = [
    ['auto', t.settings.system],
    ['en', 'English'],
    ['ko', '한국어'],
  ];

  return (
    <>
      <header className="event-header">
        <div className="breadcrumb">
          <span>{t.settings.title}</span>
          <span className="spacer" />
          <span className="save-state">{save.kind === 'saving' ? t.settings.saving : save.kind === 'saved' ? t.settings.saved : ''}</span>
          <button type="button" className="text-button" onClick={onClose}>
            {t.settings.close}
          </button>
        </div>
      </header>
      <div className="content settings">
        {save.kind === 'error' && <Banner variant="danger" title={t.settings.saveFailed}>{save.message}</Banner>}
        {snapshot && (
          <>
            {Object.values(snapshot.status.hooks).some((hooks) => hooks.nodePathMissing) && (
              <Banner variant="warn" title={t.settings.nodeMissingTitle}>
                {t.settings.nodeMissing}
              </Banner>
            )}
            <Section title={t.settings.language} description={t.settings.languageHelp}>
              <Segmented label={t.settings.language} value={snapshot.settings.locale} options={localeOptions} onChange={(locale) => update({ locale })} />
            </Section>
            <Section title={t.settings.viewer} description={t.settings.viewerHelp}>
              <ViewerChoice value={snapshot.settings.viewer} appBuilt={snapshot.status.appBuilt} onChange={(viewer) => update({ viewer })} />
            </Section>
            <Section title={t.settings.autoOpen} description={t.settings.autoOpenHelp}>
              <Segmented label={t.settings.autoOpen} value={snapshot.settings.autoOpen} options={autoOpenOptions} onChange={(autoOpen) => update({ autoOpen })} />
            </Section>
            <Section title={t.settings.snapshot} description={t.settings.snapshotHelp}>
              <NumberField value={snapshot.settings.snapshotLimit} min={1} max={500} suffix={t.settings.snapshotSuffix} onCommit={(snapshotLimit) => update({ snapshotLimit })} />
            </Section>
            <Section title={t.settings.retention} description={t.settings.retentionHelp}>
              <div className="inline-fields">
                <NumberField value={snapshot.settings.maxEvents} min={10} max={10000} suffix={t.settings.maxEventsSuffix} onCommit={(maxEvents) => update({ maxEvents })} />
                <NumberField value={snapshot.settings.maxAgeDays} min={1} max={365} suffix={t.settings.maxAgeSuffix} onCommit={(maxAgeDays) => update({ maxAgeDays })} />
              </div>
            </Section>
            <Section title={t.settings.status} description={t.settings.statusHelp}>
              <StatusList status={snapshot.status} />
            </Section>
          </>
        )}
      </div>
    </>
  );
}
