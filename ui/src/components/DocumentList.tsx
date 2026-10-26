import { useMemo, useState, type ReactNode } from 'react';
import { EJSON } from 'bson';
import { fromEJSON } from '../lib/bson';
import { useT } from '../lib/i18n';
import { DocumentView } from './Document';
import { JsonView } from './JsonView';
import { CheckIcon, CopyIcon } from './icons';

type ViewMode = 'list' | 'json';
type Tone = 'added' | 'removed';

const PAGE = 50;

export function toRelaxedJson(doc: unknown): string {
  return EJSON.stringify(doc as never, undefined, 2, { relaxed: true });
}

export function CopyButton({ text, label }: { text: () => string; label?: string }) {
  const t = useT();
  const title = label ?? t.documents.copy;
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="icon-button" title={title} aria-label={title} onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function DocumentCard({ doc, mode, tone, tag }: { doc: unknown; mode: ViewMode; tone?: Tone; tag?: ReactNode }) {
  return (
    <div className={`document-card${tone ? ` is-${tone}` : ''}`}>
      <div className="card-actions">
        <CopyButton text={() => toRelaxedJson(doc)} />
      </div>
      {tag && <div className="card-tag">{tag}</div>}
      {mode === 'list' ? <DocumentView doc={doc} tone={tone} /> : <JsonView text={toRelaxedJson(doc)} />}
    </div>
  );
}

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const t = useT();
  return (
    <div className="segmented" role="group" aria-label={t.documents.view}>
      <button type="button" aria-pressed={mode === 'list'} onClick={() => onChange('list')}>
        {t.documents.list}
      </button>
      <button type="button" aria-pressed={mode === 'json'} onClick={() => onChange('json')}>
        JSON
      </button>
    </div>
  );
}

interface Props {
  /** Raw EJSON documents as they came from the MCP server or a snapshot. */
  documents: unknown[];
  title?: string;
  total?: number | null;
  tone?: Tone;
  tag?: (doc: unknown, index: number) => ReactNode;
  extra?: ReactNode;
}

/** Compass "Documents" tab: toolbar with range + view switch, then one card per document. */
export function DocumentList({ documents, title: titleProp, total, tone, tag, extra }: Props) {
  const t = useT();
  const title = titleProp ?? t.documents.title;
  const [mode, setMode] = useState<ViewMode>('list');
  const [limit, setLimit] = useState(PAGE);
  const parsed = useMemo(() => documents.map((doc) => fromEJSON(doc)), [documents]);
  const count = parsed.length;
  const range = count === 0 ? '0' : `1 – ${count}`;

  return (
    <section className="document-list" aria-label={title}>
      <div className="toolbar">
        <strong>{title}</strong>
        <span>
          {t.documents.range(range, (total ?? count).toLocaleString())}
          {total != null && total > count ? t.documents.returned : ''}
        </span>
        {extra}
        <span className="spacer" />
        <CopyButton text={() => `[\n${parsed.map(toRelaxedJson).join(',\n')}\n]`} label={t.documents.copyAll} />
        <ViewToggle mode={mode} onChange={setMode} />
      </div>
      {parsed.slice(0, limit).map((doc, index) => (
        <DocumentCard key={index} doc={doc} mode={mode} tone={tone} tag={tag?.(doc, index)} />
      ))}
      {count > limit && (
        <button type="button" className="text-button" onClick={() => setLimit((n) => n + PAGE)}>
          {t.documents.showMore(Math.min(PAGE, count - limit))}
        </button>
      )}
    </section>
  );
}
