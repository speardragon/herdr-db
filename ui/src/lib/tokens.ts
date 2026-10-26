/** Highlighting roles shared by the JSON view and the mongosh-style query text. */
export type TokenKind = 'key' | 'operator' | 'ejson' | 'string' | 'number' | 'boolean' | 'null' | 'objectid' | 'punct' | 'space';

export interface Token {
  kind: TokenKind;
  text: string;
}

export function textOf(tokens: readonly Token[]): string {
  return tokens.map((token) => token.text).join('');
}
