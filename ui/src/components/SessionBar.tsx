import type { ReactNode } from 'react';
import { useT } from '../lib/i18n';
import { herdrPlace, sessionTitle, shortId } from '../lib/session';
import type { CapturedEvent } from '../lib/types';
import { CopyButton } from './DocumentList';

function Fact({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <span className="session-fact" title={title}>
      <span className="session-label">{label}</span>
      {children}
    </span>
  );
}

/** Which agent session made the call: herdr workspace and tab, the session's title, folder and id. */
export function SessionBar({ event }: { event: CapturedEvent }) {
  const t = useT();
  const { herdr, cwd, sessionId } = event.context;
  const place = herdrPlace(herdr);
  const title = sessionTitle(herdr?.paneTitle);
  if (!place && !title && !cwd && !sessionId) return null;
  const ids = herdr ? [herdr.workspaceId, herdr.tabId, herdr.paneId].filter(Boolean).join(' · ') : undefined;
  return (
    <div className="session-bar" aria-label={t.session.label}>
      {place?.workspace && (
        <Fact label={t.session.workspace} title={ids}>
          <span className="session-value">{place.workspace}</span>
        </Fact>
      )}
      {place?.tab && (
        <Fact label={t.session.tab} title={ids}>
          <span className="session-value">{place.tab}</span>
        </Fact>
      )}
      {title && (
        <Fact label={t.session.title}>
          <span className="session-value">{title}</span>
        </Fact>
      )}
      {cwd && (
        <Fact label={t.session.folder} title={cwd}>
          <span className="session-value session-path">{cwd}</span>
        </Fact>
      )}
      {sessionId && (
        <Fact label={t.session.id} title={sessionId}>
          <span className="session-value session-path">{shortId(sessionId)}</span>
          <CopyButton text={() => sessionId} label={t.session.copyId} />
        </Fact>
      )}
    </div>
  );
}
