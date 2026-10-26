import type { ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { ShellText } from './Highlight';

function isEmpty(value: unknown) {
  return value == null || (typeof value === 'object' && Object.keys(value as object).length === 0);
}

function QueryInput({ value, placeholder }: { value: unknown; placeholder: string }) {
  if (isEmpty(value)) return <div className="query-input placeholder">{placeholder}</div>;
  return <div className="query-input">
      <ShellText value={value} />
    </div>;
}

export function QueryRow({ label, value, placeholder = '{}' }: { label: string; value: unknown; placeholder?: string }) {
  return (
    <div className="query-row">
      <span className="query-row-label">{label}</span>
      <QueryInput value={value} placeholder={placeholder} />
    </div>
  );
}

function Option({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || isEmpty(value)) return null;
  return (
    <span className="query-option">
      <span className="query-row-label">{label}</span>
      <span className="query-input">
        <ShellText value={value} />
      </span>
    </span>
  );
}

/** Read-only version of Compass's query bar, filled with what the agent asked for. */
export function QueryBar({ input, children }: { input: Record<string, unknown>; children?: ReactNode }) {
  const t = useT();
  const filter = input.filter ?? input.query;
  const options = (['projection', 'sort', 'limit', 'skip', 'upsert'] as const).filter((key) => input[key] !== undefined);
  return (
    <div className="query-bar">
      <QueryRow label="Filter" value={filter} placeholder={t.query.allDocuments} />
      {children}
      {options.length > 0 && (
        <div className="query-options">
          <Option label="Project" value={input.projection} />
          <Option label="Sort" value={input.sort} />
          <Option label="Skip" value={input.skip} />
          <Option label="Limit" value={input.limit} />
          {input.upsert !== undefined && <Option label="Upsert" value={input.upsert} />}
        </div>
      )}
    </div>
  );
}

/** Aggregation pipeline as Compass-like stage cards. */
export function PipelineView({ pipeline }: { pipeline: unknown }) {
  const t = useT();
  const stages = Array.isArray(pipeline) ? pipeline : [];
  return (
    <section className="pipeline" aria-label={t.query.pipeline}>
      <div className="toolbar">
        <strong>{t.query.pipeline}</strong>
        <span>{t.query.stages(stages.length)}</span>
      </div>
      {stages.map((stage, index) => {
        const [operator = '?', body] = Object.entries((stage ?? {}) as Record<string, unknown>)[0] ?? [];
        const writes = operator === '$out' || operator === '$merge';
        return (
          <div className="stage" key={index}>
            <div className="stage-header">
              <span className="event-time">{t.query.stage(index + 1)}</span>
              <span className="stage-operator">{operator}</span>
              {writes && <span className="badge badge-write">{t.query.writes}</span>}
            </div>
            <pre className="stage-body">
              <ShellText value={body} />
            </pre>
          </div>
        );
      })}
    </section>
  );
}
