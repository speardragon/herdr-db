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
