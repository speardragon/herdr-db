import { useMemo } from 'react';
import { tokenizeJson } from '../lib/json';
import { TokenSpans } from './Highlight';

/** Pretty-printed JSON with each token colored by its role (key, string, number …), Compass-style. */
export function JsonView({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  return (
    <pre className="json-doc">
      <TokenSpans tokens={tokens} />
    </pre>
  );
}
