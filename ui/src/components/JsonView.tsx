import { useMemo } from 'react';
import { tokenizeJson } from '../lib/json';

/** Pretty-printed JSON with each token colored by its role (key, string, number …), Compass-style. */
export function JsonView({ text }: { text: string }) {
  const tokens = useMemo(() => tokenizeJson(text), [text]);
  return (
    <pre className="json-doc">
      {tokens.map((token, index) => (token.kind === 'space' ? token.text : <span key={index} className={`json-${token.kind}`}>{token.text}</span>))}
    </pre>
  );
}
