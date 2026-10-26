import { useT } from '../lib/i18n';
import type { CapturedEvent } from '../lib/types';
import { Banner, StatCards } from './Banner';
import { DocumentList } from './DocumentList';
import { PipelineView, QueryBar } from './QueryBar';

function documentsOf(event: CapturedEvent): unknown[] {
  const docs = event.result?.documents;
  return Array.isArray(docs) ? docs : [];
}

function LimitsNotice({ event }: { event: CapturedEvent }) {
  const t = useT();
  const limits = event.result?.appliedLimits;
  if (!Array.isArray(limits) || limits.length === 0) return null;
  return <span className="badge badge-write" title={limits.join(', ')}>{t.event.cappedBy(limits.join(', '))}</span>;
}

export function FindView({ event }: { event: CapturedEvent }) {
  const total = event.result?.queryResultsCount;
  return (
    <>
      <QueryBar input={event.input} />
      <DocumentList documents={documentsOf(event)} total={typeof total === 'number' ? total : null} extra={<LimitsNotice event={event} />} />
    </>
  );
}

export function AggregateView({ event }: { event: CapturedEvent }) {
  const t = useT();
  return (
    <>
      <PipelineView pipeline={event.input.pipeline} />
      <DocumentList title={t.event.results} documents={documentsOf(event)} extra={<LimitsNotice event={event} />} />
    </>
  );
}

export function CountView({ event }: { event: CapturedEvent }) {
  const t = useT();
  const count = event.result?.count;
  return (
    <>
      <QueryBar input={event.input} />
      <StatCards items={[{ label: t.write.count, value: typeof count === 'number' ? count.toLocaleString() : '–' }]} />
    </>
  );
}

export function ExportView({ event }: { event: CapturedEvent }) {
  const t = useT();
  return (
    <>
      {Array.isArray(event.input.pipeline) ? <PipelineView pipeline={event.input.pipeline} /> : <QueryBar input={event.input} />}
      <Banner variant="info" title="Export">
        {event.resultText ?? t.event.exportBody}
      </Banner>
    </>
  );
}
