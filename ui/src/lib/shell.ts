import { bsonTypeOf, displayValue, entriesOf, fromEJSON } from './bson';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const INLINE_LIMIT = 72;

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
}

function formatKey(key: string): string {
  return IDENTIFIER.test(key) ? key : quote(key);
}

function scalar(value: unknown): string {
  const type = bsonTypeOf(value);
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

function format(value: unknown, depth: number): string {
  const type = bsonTypeOf(value);
  if (type !== 'Array' && type !== 'Object') return scalar(value);

  const entries = entriesOf(value);
  const [open, close] = type === 'Array' ? ['[', ']'] : ['{', '}'];
  if (entries.length === 0) return `${open}${close}`;

  const parts = entries.map(([key, child]) => (type === 'Array' ? format(child, depth + 1) : `${formatKey(key)}: ${format(child, depth + 1)}`));
  const inline = type === 'Array' ? `[${parts.join(', ')}]` : `{ ${parts.join(', ')} }`;
  if (inline.length + depth * 2 <= INLINE_LIMIT && !inline.includes('\n')) return inline;

  const pad = '  '.repeat(depth + 1);
  return `${open}\n${parts.map((part) => `${pad}${part}`).join(',\n')}\n${'  '.repeat(depth)}${close}`;
}

/** mongosh-style text for a query/update/pipeline coming from an MCP tool input (EJSON). */
export function toShell(ejsonValue: unknown): string {
  return format(fromEJSON(ejsonValue), 0);
}
