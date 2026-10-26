import { AGENT_LABELS, type HerdrContext } from './types';

/** Where in herdr a call came from; ids stand in for names that couldn't be read. */
export function herdrPlace(herdr: HerdrContext | null | undefined): { workspace: string | null; tab: string | null } | null {
  if (!herdr) return null;
  const workspace = herdr.workspaceLabel || herdr.workspaceId;
  const tab = herdr.tabLabel || herdr.tabId;
  return workspace || tab ? { workspace, tab } : null;
}

const GENERIC_TITLES = new Set(Object.values(AGENT_LABELS).flatMap((label) => [label.toLowerCase(), label.split(' ')[0].toLowerCase()]));

/** The agent's terminal title (its session title), unless it only names the agent. */
export function sessionTitle(title: string | null | undefined): string | null {
  const trimmed = title?.trim();
  if (!trimmed || GENERIC_TITLES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function shortId(id: string): string {
  return id.split('-')[0];
}
