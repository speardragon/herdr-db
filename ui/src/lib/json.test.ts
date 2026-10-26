import { describe, expect, it } from 'vitest';
import { tokenizeJson, type JsonToken } from './json';

const kinds = (tokens: JsonToken[]) => tokens.filter((token) => token.kind !== 'space').map((token) => [token.kind, token.text]);

describe('tokenizeJson', () => {
  it('tells keys apart from string values', () => {
    expect(kinds(tokenizeJson('{"name": "name"}'))).toEqual([
      ['punct', '{'],
      ['key', '"name"'],
      ['punct', ':'],
      ['string', '"name"'],
      ['punct', '}'],
    ]);
  });

  it('colors numbers, booleans and null', () => {
    expect(kinds(tokenizeJson('[1, -2.5e3, true, false, null]'))).toEqual([
      ['punct', '['],
      ['number', '1'],
      ['punct', ','],
      ['number', '-2.5e3'],
      ['punct', ','],
      ['boolean', 'true'],
      ['punct', ','],
      ['boolean', 'false'],
      ['punct', ','],
      ['null', 'null'],
      ['punct', ']'],
    ]);
  });

  it('keeps escaped quotes and colons inside strings', () => {
    expect(kinds(tokenizeJson('{"a\\":b": "x\\"y: z"}'))).toEqual([
      ['punct', '{'],
      ['key', '"a\\":b"'],
      ['punct', ':'],
      ['string', '"x\\"y: z"'],
      ['punct', '}'],
    ]);
  });

  it('shows EJSON wrappers as their BSON type', () => {
    const text = '{"_id": {"$oid": "6adedc58761ef473c665d0fb"}, "at": {"$date": "2024-03-01T09:00:00Z"}, "n": {"$numberLong": "9007199254740993"}, "s": "$oid"}';
    expect(kinds(tokenizeJson(text)).filter(([kind]) => kind !== 'punct')).toEqual([
      ['key', '"_id"'],
      ['ejson', '"$oid"'],
      ['objectid', '"6adedc58761ef473c665d0fb"'],
      ['key', '"at"'],
      ['ejson', '"$date"'],
      ['number', '"2024-03-01T09:00:00Z"'],
      ['key', '"n"'],
      ['ejson', '"$numberLong"'],
      ['number', '"9007199254740993"'],
      ['key', '"s"'],
      ['string', '"$oid"'],
    ]);
  });

  it('does not treat a $-key with a non-scalar value as a typed value', () => {
    const tokens = kinds(tokenizeJson('{"$set": {"a": "b"}}')).filter(([kind]) => kind !== 'punct');
    expect(tokens).toEqual([
      ['ejson', '"$set"'],
      ['key', '"a"'],
      ['string', '"b"'],
    ]);
  });

  it('loses no characters, so the text still copies and wraps as before', () => {
    const text = '{\n  "a": [1, {"b": null}],\n  "c": "d"\n}';
    expect(tokenizeJson(text).map((token) => token.text).join('')).toBe(text);
  });
});
