import { describe, expect, it } from 'vitest';
import { herdrPlace, sessionTitle, shortId } from './session';

describe('session facts', () => {
  it('names the herdr workspace and tab, falling back to their ids', () => {
    expect(herdrPlace({ workspaceId: 'w1', tabId: 'w1:t1', paneId: 'w1:p1', workspaceLabel: 'shop', tabLabel: 'billing' })).toEqual({ workspace: 'shop', tab: 'billing' });
    expect(herdrPlace({ workspaceId: 'w1', tabId: 'w1:t1', paneId: 'w1:p1' })).toEqual({ workspace: 'w1', tab: 'w1:t1' });
    expect(herdrPlace({ workspaceId: null, tabId: null, paneId: null })).toBeNull();
    expect(herdrPlace(null)).toBeNull();
  });

  it('hides a pane title that only names the agent', () => {
    expect(sessionTitle('Refund report')).toBe('Refund report');
    expect(sessionTitle('Claude Code')).toBeNull();
    expect(sessionTitle('codex')).toBeNull();
    expect(sessionTitle('  ')).toBeNull();
    expect(sessionTitle(undefined)).toBeNull();
  });

  it('shortens session ids to their first block', () => {
    expect(shortId('72d5be5b-7da8-44d2-962c-78d08e7a9636')).toBe('72d5be5b');
    expect(shortId('abc')).toBe('abc');
  });
});
