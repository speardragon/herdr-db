import { bsonTypeOf, displayValue, entriesOf, fromEJSON, type BsonType } from './bson';
import { textOf, type Token, type TokenKind } from './tokens';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const INLINE_LIMIT = 72;

const punct = (text: string): Token => ({ kind: 'punct', text });
const space = (text: string): Token => ({ kind: 'space', text });

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function formatKey(key: string): Token {
  return { kind: key.startsWith('$') ? 'operator' : 'key', text: IDENTIFIER.test(key) ? key : quote(key) };
}

const SCALAR_KINDS: Partial<Record<BsonType, TokenKind>> = {
  Int32: 'number',
  Int64: 'number',
  Double: 'number',
  Decimal128: 'number',
  Date: 'number',
  Boolean: 'boolean',
  Null: 'null',
  Undefined: 'null',
  ObjectId: 'objectid',
};

function scalarText(value: unknown, type: BsonType): string {
  switch (type) {
    case 'String':
      return quote(value as string);
    case 'Date':
      return `ISODate('${(value as Date).toISOString()}')`;
    case 'Int64':
      return `NumberLong('${String(value)}')`;
    default:
      return displayValue(value, type);
  }
}

function scalar(value: unknown, type: BsonType): Token {
  return { kind: SCALAR_KINDS[type] ?? 'string', text: scalarText(value, type) };
}

function joined(parts: Token[][]): Token[] {
  return parts.flatMap((part, index) => (index === 0 ? part : [punct(','), space(' '), ...part]));
}

function format(value: unknown, depth: number): Token[] {
  const type = bsonTypeOf(value);
  if (type !== 'Array' && type !== 'Object') return [scalar(value, type)];

  const entries = entriesOf(value);
  const [open, close] = type === 'Array' ? ['[', ']'] : ['{', '}'];
  if (entries.length === 0) return [punct(`${open}${close}`)];

  const parts = entries.map(([key, child]) =>
    type === 'Array' ? format(child, depth + 1) : [formatKey(key), punct(':'), space(' '), ...format(child, depth + 1)],
  );
  const inline = type === 'Array' ? [punct('['), ...joined(parts), punct(']')] : [punct('{'), space(' '), ...joined(parts), space(' '), punct('}')];
  const inlineText = textOf(inline);
  if (inlineText.length + depth * 2 <= INLINE_LIMIT && !inlineText.includes('\n')) return inline;

  const pad = '  '.repeat(depth + 1);
  return [
    punct(open),
    ...parts.flatMap((part, index) => [...(index === 0 ? [] : [punct(',')]), space(`\n${pad}`), ...part]),
    space(`\n${'  '.repeat(depth)}`),
    punct(close),
  ];
}

/** mongosh-style text for a query/update/pipeline coming from an MCP tool input (EJSON), split into highlighting tokens. */
export function toShellTokens(ejsonValue: unknown): Token[] {
  return format(fromEJSON(ejsonValue), 0);
}

/** mongosh-style text for a query/update/pipeline coming from an MCP tool input (EJSON). */
export function toShell(ejsonValue: unknown): string {
  return textOf(toShellTokens(ejsonValue));
}
