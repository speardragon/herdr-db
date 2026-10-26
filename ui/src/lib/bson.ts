import { Binary, EJSON } from 'bson';

export type BsonType =
  | 'ObjectId'
  | 'String'
  | 'Int32'
  | 'Double'
  | 'Int64'
  | 'Decimal128'
  | 'Boolean'
  | 'Date'
  | 'Null'
  | 'Undefined'
  | 'Array'
  | 'Object'
  | 'Binary'
  | 'UUID'
  | 'Timestamp'
  | 'BSONRegExp'
  | 'Code'
  | 'MinKey'
  | 'MaxKey'
  | 'BSONSymbol'
  | 'DBRef';

const BSONTYPE_TO_TYPE: Record<string, BsonType> = {
  ObjectId: 'ObjectId',
  ObjectID: 'ObjectId',
  Int32: 'Int32',
  Double: 'Double',
  Long: 'Int64',
  Decimal128: 'Decimal128',
  Binary: 'Binary',
  Timestamp: 'Timestamp',
  BSONRegExp: 'BSONRegExp',
  Code: 'Code',
  MinKey: 'MinKey',
  MaxKey: 'MaxKey',
  BSONSymbol: 'BSONSymbol',
  Symbol: 'BSONSymbol',
  DBRef: 'DBRef',
};

/** Turns MCP (relaxed) or snapshot (canonical) EJSON into BSON values without losing type information. */
export function fromEJSON<T = unknown>(value: unknown): T {
  if (value === undefined) return value as T;
  try {
    return EJSON.deserialize(value as never, { relaxed: false }) as T;
  } catch {
    return value as T;
  }
}

export function bsonTypeOf(value: unknown): BsonType {
  if (value === null) return 'Null';
  if (value === undefined) return 'Undefined';
  if (typeof value === 'string') return 'String';
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') return Number.isInteger(value) && Math.abs(value) <= 2 ** 31 ? 'Int32' : 'Double';
  if (typeof value === 'bigint') return 'Int64';
  if (value instanceof Date) return 'Date';
  if (Array.isArray(value)) return 'Array';
  const tag = (value as { _bsontype?: string })._bsontype;
  if (tag && BSONTYPE_TO_TYPE[tag]) {
    if (tag === 'Binary' && (value as Binary).sub_type === Binary.SUBTYPE_UUID) return 'UUID';
    return BSONTYPE_TO_TYPE[tag];
  }
  return 'Object';
}

export function isContainer(type: BsonType): type is 'Array' | 'Object' {
  return type === 'Array' || type === 'Object';
}

/** Ordered [key, value] pairs of a document or array, the way Compass lists them. */
export function entriesOf(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.map((item, index) => [String(index), item]);
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>);
  return [];
}

function truncate(text: string, length = 1000): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function isoDate(value: Date): string {
  return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString().replace('Z', '+00:00');
}

function uuidOf(value: Binary): string {
  try {
    return value.toUUID().toString();
  } catch {
    return value.toString('hex');
  }
}

/** Display text matching Compass's BSONValue component. */
export function displayValue(value: unknown, type: BsonType = bsonTypeOf(value)): string {
  const v = value as never as { toString(enc?: string): string } & Record<string, unknown>;
  switch (type) {
    case 'String':
      return `"${truncate(String(value))}"`;
    case 'ObjectId':
      return `ObjectId('${v.toString()}')`;
    case 'Date':
      return isoDate(value as Date);
    case 'Int32':
    case 'Double':
      return String(typeof value === 'number' ? value : (v.valueOf as () => number)());
    case 'Int64':
      return `Long('${v.toString()}')`;
    case 'Decimal128':
      return `Decimal128('${v.toString()}')`;
    case 'Boolean':
    case 'Null':
    case 'Undefined':
      return String(value);
    case 'UUID':
      return `UUID('${uuidOf(value as Binary)}')`;
    case 'Binary': {
      const bin = value as Binary;
      return `Binary.createFromBase64('${truncate(bin.toString('base64'), 100)}', ${bin.sub_type})`;
    }
    case 'Timestamp':
      return `Timestamp({ t: ${String(v.t ?? v.high)}, i: ${String(v.i ?? v.low)} })`;
    case 'BSONRegExp':
      return `/${String(v.pattern)}/${String(v.options)}`;
    case 'Code':
      return `Code('${String(v.code)}')`;
    case 'MinKey':
    case 'MaxKey':
      return `${type}()`;
    case 'BSONSymbol':
      return `Symbol('${String(v.value)}')`;
    case 'DBRef':
      return `DBRef('${String(v.collection)}', '${String(v.oid)}')`;
    case 'Array': {
      const length = (value as unknown[]).length;
      return `Array (${length > 0 ? length : 'empty'})`;
    }
    case 'Object': {
      const keys = Object.keys((value ?? {}) as object).length;
      return `Object (${keys > 0 ? keys : 'empty'})`;
    }
  }
}

/** Stable text used to compare two values for the diff view. */
export function valueKey(value: unknown): string {
  return EJSON.stringify({ v: value as never }, { relaxed: false });
}
