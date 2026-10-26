import { useMemo } from 'react';
import { toShellTokens } from '../lib/shell';
import type { Token } from '../lib/tokens';

/** Colored spans for highlighting tokens; whitespace stays plain text so copying and wrapping are unchanged. */
export function TokenSpans({ tokens }: { tokens: readonly Token[] }) {
  return <>{tokens.map((token, index) => (token.kind === 'space' ? token.text : <span key={index} className={`tok-${token.kind}`}>{token.text}</span>))}</>;
}

/** A query, update or pipeline stage in highlighted mongosh syntax. */
export function ShellText({ value }: { value: unknown }) {
  const tokens = useMemo(() => toShellTokens(value), [value]);
  return <TokenSpans tokens={tokens} />;
}
