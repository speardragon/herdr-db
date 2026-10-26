import { useState } from 'react';
import { useT } from '../lib/i18n';
import { rowToggle, toggledIndex } from '../lib/toggle';
import { ShellText } from './Highlight';
import { CaretIcon } from './icons';

function Stage({ stage, index, open, onToggle }: { stage: unknown; index: number; open: boolean; onToggle: () => void }) {
  const t = useT();
  const [operator = '?', body] = Object.entries((stage ?? {}) as Record<string, unknown>)[0] ?? [];
  const writes = operator === '$out' || operator === '$merge';
  return (
    <div className={`stage${open ? '' : ' is-collapsed'}`}>
      <div className="stage-header" onClick={rowToggle(onToggle)}>
        <button type="button" className="caret" aria-expanded={open} aria-label={open ? t.query.collapseStage : t.query.expandStage}>
          <CaretIcon open={open} />
        </button>
        <span className="event-time">{t.query.stage(index + 1)}</span>
        <span className="stage-operator">{operator}</span>
        {writes && <span className="badge badge-write">{t.query.writes}</span>}
        {!open && (
          <span className="stage-preview">
            <ShellText value={body} />
          </span>
        )}
      </div>
      {open && (
        <pre className="stage-body">
          <ShellText value={body} />
        </pre>
      )}
    </div>
  );
}

/** Aggregation pipeline as Compass-like stage cards; click a stage header to fold it to one line. */
export function PipelineView({ pipeline }: { pipeline: unknown }) {
  const t = useT();
  const stages = Array.isArray(pipeline) ? pipeline : [];
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const allCollapsed = stages.length > 0 && collapsed.size === stages.length;
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(stages.map((_, index) => index)));
  return (
    <section className="pipeline" aria-label={t.query.pipeline}>
      <div className="toolbar">
        <strong>{t.query.pipeline}</strong>
        <span>{t.query.stages(stages.length)}</span>
        <span className="spacer" />
        {stages.length > 1 && (
          <button type="button" className="text-button" onClick={toggleAll}>
            {allCollapsed ? t.query.expandAll : t.query.collapseAll}
          </button>
        )}
      </div>
      {stages.map((stage, index) => (
        <Stage
          key={index}
          stage={stage}
          index={index}
          open={!collapsed.has(index)}
          onToggle={() => setCollapsed((current) => toggledIndex(current, index))}
        />
      ))}
    </section>
  );
}
