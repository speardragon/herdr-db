export type JsonTokenKind = 'key' | 'ejson' | 'string' | 'number' | 'boolean' | 'null' | 'objectid' | 'punct' | 'space';

export interface JsonToken {
  kind: JsonTokenKind;
  text: string;
}

// One alternative per token: string (+ an optional trailing colon that makes it a key), number, literal, punctuation, whitespace.
const TOKEN = /("(?:[^"\\]|\\.)*")(?=(\s*:)?)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(true|false)|(null)|([{}[\],:])|(\s+)|(.)/gy;

// The value inside an EJSON wrapper ({"$oid": "…"}) takes the color of the BSON type it stands for.
const WRAPPER_KINDS: Record<string, JsonTokenKind> = {
  '"$oid"': 'objectid',
  '"$date"': 'number',
  '"$numberInt"': 'number',
  '"$numberLong"': 'number',
  '"$numberDouble"': 'number',
  '"$numberDecimal"': 'number',
};

function kindOf(match: RegExpExecArray): JsonTokenKind {
  if (match[1] !== undefined) return match[2] === undefined ? 'string' : match[1].startsWith('"$') ? 'ejson' : 'key';
  if (match[3] !== undefined) return 'number';
  if (match[4] !== undefined) return 'boolean';
  if (match[5] !== undefined) return 'null';
  if (match[7] !== undefined) return 'space';
  return 'punct';
}

/** Splits JSON text (as EJSON.stringify prints it) into tokens; joining their text gives back the input. */
export function tokenizeJson(text: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let wrapper: JsonTokenKind | undefined;
  for (const match of text.matchAll(TOKEN)) {
    const kind = kindOf(match);
    const scalar = kind === 'string' || kind === 'number';
    tokens.push({ kind: wrapper && scalar ? wrapper : kind, text: match[0] });
    if (kind === 'ejson') wrapper = WRAPPER_KINDS[match[0]];
    else if (kind !== 'space' && match[0] !== ':') wrapper = undefined;
  }
  return tokens;
}
