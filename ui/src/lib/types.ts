export type EventKind = 'read' | 'write' | 'admin' | 'meta' | null;

export type AgentId = 'claude' | 'codex';

export const AGENT_LABELS: Record<AgentId, string> = { claude: 'Claude Code', codex: 'Codex' };

/** Events captured before Codex support carry no agent; they all came from Claude Code. */
export function agentLabel(agent: AgentId | undefined): string {
  return AGENT_LABELS[agent ?? 'claude'] ?? AGENT_LABELS.claude;
}

export interface HerdrContext {
  workspaceId: string | null;
  tabId: string | null;
  paneId: string | null;
  workspaceLabel?: string | null;
  tabLabel?: string | null;
  /** The agent's terminal title at the time of the call, e.g. the Claude Code session title. */
  paneTitle?: string | null;
}

export interface Namespace {
  database: string | null;
  collection: string | null;
}

export interface EventSummary {
  id: string;
  ts: string;
  agent?: AgentId;
  server: string;
  tool: string;
  kind: EventKind;
  status: 'ok' | 'error';
  namespace: Namespace;
  count: number | null;
  total: number | null;
  project: string | null;
  sessionId: string | null;
  herdr: HerdrContext | null;
}

export interface Snapshot {
  before?: unknown[];
  after?: unknown[] | null;
  truncated?: boolean;
  matched?: number | null;
  error?: string;
}

export interface CapturedEvent {
  id: string;
  ts: string;
  agent?: AgentId;
  server: string;
  tool: string;
  kind: EventKind;
  status: 'ok' | 'error';
  namespace: Namespace;
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  resultText: string | null;
  snapshot: Snapshot | null;
  durationMs: number | null;
  context: {
    sessionId: string | null;
    toolUseId: string | null;
    cwd: string;
    project: string | null;
    herdr: HerdrContext | null;
  };
}
