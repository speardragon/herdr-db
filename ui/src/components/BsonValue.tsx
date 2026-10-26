import { bsonTypeOf, displayValue, type BsonType } from '../lib/bson';

export function BsonValue({ value, type = bsonTypeOf(value), className }: { value: unknown; type?: BsonType; className?: string }) {
  const text = displayValue(value, type);
  return (
    <span className={['bson', `bson-${type}`, className].filter(Boolean).join(' ')} title={text}>
      {text}
    </span>
  );
}
