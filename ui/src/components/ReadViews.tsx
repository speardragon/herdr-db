import type { CapturedEvent } from '../lib/types';
import { Banner, StatCards } from './Banner';
import { DocumentList } from './DocumentList';
import { PipelineView, QueryBar } from './QueryBar';

function documentsOf(event: CapturedEvent): unknown[] {
  const docs = event.result?.documents;
  return Array.isArray(docs) ? docs : [];
}

function LimitsNotice({ event }: { event: CapturedEvent }) {
  const limits = event.result?.appliedLimits;
  if (!Array.isArray(limits) || limits.length === 0) return null;
  return <span className="badge badge-write" title={limits.join(', ')}>capped by {limits.join(', ')}</span>;
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
  return (
    <>
      <PipelineView pipeline={event.input.pipeline} />
      <DocumentList title="Results" documents={documentsOf(event)} extra={<LimitsNotice event={event} />} />
    </>
  );
}

export function CountView({ event }: { event: CapturedEvent }) {
  const count = event.result?.count;
  return (
    <>
      <QueryBar input={event.input} />
      <StatCards items={[{ label: 'Count', value: typeof count === 'number' ? count.toLocaleString() : '–' }]} />
    </>
  );
}

export function ExportView({ event }: { event: CapturedEvent }) {
  return (
    <>
      {Array.isArray(event.input.pipeline) ? <PipelineView pipeline={event.input.pipeline} /> : <QueryBar input={event.input} />}
      <Banner variant="info" title="Export">
        {event.resultText ?? '결과는 MCP 리소스로 내보내졌습니다.'}
      </Banner>
    </>
  );
}
