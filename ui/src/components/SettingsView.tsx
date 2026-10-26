import { useEffect, useState, type ReactNode } from 'react';
import { getSettings, saveSettings, type AgentHookStatus, type AutoOpen, type Settings, type SettingsSnapshot, type ViewerMode } from '../lib/settings';
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
  const options: Array<{ mode: ViewerMode; title: string; body: string; disabled?: boolean }> = [
    {
      mode: 'app',
      title: '네이티브 창',
      body: appBuilt ? '호출이 오면 터미널 포커스를 빼앗지 않고 창이 앞으로 뜹니다. Dock 대신 메뉴바에 있습니다.' : '앱이 빌드되지 않았습니다. npm run build:mac 실행 후 선택할 수 있습니다.',
      disabled: !appBuilt,
    },
    {
      mode: 'browser',
      title: '브라우저 (로컬 포트)',
      body: '기본 브라우저 탭에서 봅니다. 이미 열린 탭은 앞으로 끌어올 수 없어서, 새 호출은 탭 제목의 숫자로 알려줍니다.',
    },
  ];
  return (
    <div className="choice-grid" role="radiogroup" aria-label="띄우는 방식">
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

function hookState(hooks: AgentHookStatus): string {
  if (hooks.events.length) return hooks.events.join(', ');
  return hooks.detected ? '설치되지 않음 — node bin/install-hooks.mjs' : '이 맥에서 찾지 못함';
}

function StatusList({ status }: { status: SettingsSnapshot['status'] }) {
  const rows: Array<[string, ReactNode]> = [
    ...Object.values(status.hooks).map((hooks): [string, ReactNode] => [`${hooks.label} 훅`, hookState(hooks)]),
    ['서버', `http://127.0.0.1:${status.port}/`],
    ['연결된 뷰어', `창 ${status.viewers.app} · 브라우저 탭 ${status.viewers.browser}`],
    ['저장된 호출', `${status.events}개 · ${status.home}`],
  ];
  return (
    <dl className="status-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsView({ onClose }: { onClose: () => void }) {
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
    ['always', '모든 호출'],
    ['writes', '쓰기만'],
    ['never', '띄우지 않음'],
  ];

  return (
    <>
      <header className="event-header">
        <div className="breadcrumb">
          <span>설정</span>
          <span className="spacer" />
          <span className="save-state">{save.kind === 'saving' ? '저장 중…' : save.kind === 'saved' ? '저장됨' : ''}</span>
          <button type="button" className="text-button" onClick={onClose}>
            닫기
          </button>
        </div>
      </header>
      <div className="content settings">
        {save.kind === 'error' && <Banner variant="danger" title="설정을 저장하지 못했습니다">{save.message}</Banner>}
        {snapshot && (
          <>
            {Object.values(snapshot.status.hooks).some((hooks) => hooks.nodePathMissing) && (
              <Banner variant="warn" title="훅이 가리키는 node 경로가 없습니다">node bin/install-hooks.mjs 를 다시 실행하세요.</Banner>
            )}
            <Section title="띄우는 방식" description="바꾸면 바로 새 방식으로 열리고, 네이티브 창은 닫힙니다.">
              <ViewerChoice value={snapshot.settings.viewer} appBuilt={snapshot.status.appBuilt} onChange={(viewer) => update({ viewer })} />
            </Section>
            <Section title="자동으로 띄우기" description="MongoDB MCP 호출이 들어왔을 때 뷰어를 앞으로 가져올지 정합니다. 기록은 항상 남습니다.">
              <div className="segmented" role="group" aria-label="자동으로 띄우기">
                {autoOpenOptions.map(([mode, label]) => (
                  <button key={mode} type="button" aria-pressed={snapshot.settings.autoOpen === mode} onClick={() => update({ autoOpen: mode })}>
                    {label}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="쓰기 스냅샷" description="update-many / delete-many 직전에 읽어 두는 문서 수입니다. diff는 이 문서들로 만듭니다.">
              <NumberField value={snapshot.settings.snapshotLimit} min={1} max={500} suffix="개 문서" onCommit={(snapshotLimit) => update({ snapshotLimit })} />
            </Section>
            <Section title="보관" description="캡처된 문서에는 실제 데이터가 들어 있습니다. 둘 중 하나라도 넘으면 오래된 기록부터 지웁니다.">
              <div className="inline-fields">
                <NumberField value={snapshot.settings.maxEvents} min={10} max={10000} suffix="개까지" onCommit={(maxEvents) => update({ maxEvents })} />
                <NumberField value={snapshot.settings.maxAgeDays} min={1} max={365} suffix="일까지" onCommit={(maxAgeDays) => update({ maxAgeDays })} />
              </div>
            </Section>
            <Section title="상태" description="Codex 훅은 Codex에서 /hooks를 열어 한 번 신뢰해야 동작합니다. Node.js 경로나 플러그인 위치가 바뀌어 훅 명령이 달라지면 다시 신뢰해야 합니다.">
              <StatusList status={snapshot.status} />
            </Section>
          </>
        )}
      </div>
    </>
  );
}
