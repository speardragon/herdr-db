import { describe, expect, it } from 'vitest';
import { bsonTypeOf, displayValue, entriesOf, fromEJSON, valueKey } from './bson';
import { diffDocuments, diffStats, pairDocuments, type DiffNode } from './diff';
import { toShell } from './shell';
import { rowToggle } from './toggle';

const relaxedDoc = {
  _id: { $oid: '6adedc58761ef473c665d0fb' },
  name: 'Kim',
  age: 31,
  score: { $numberLong: '9007199254740993' },
  ratio: 1.5,
  joined: { $date: '2024-03-01T09:00:00.000Z' },
  tags: ['a', 'b'],
  addr: { city: 'Seoul' },
  active: true,
  dec: { $numberDecimal: '12.34' },
  nothing: null,
  uuid: { $binary: { base64: 'AAECAwQFBgcICQoLDA0ODw==', subType: '04' } },
};

describe('bson', () => {
  const doc = fromEJSON<Record<string, unknown>>(relaxedDoc);

  it('keeps BSON types from relaxed EJSON', () => {
    const types = Object.fromEntries(entriesOf(doc).map(([key, value]) => [key, bsonTypeOf(value)]));
    expect(types).toEqual({
      _id: 'ObjectId',
      name: 'String',
      age: 'Int32',
      score: 'Int64',
      ratio: 'Double',
      joined: 'Date',
      tags: 'Array',
      addr: 'Object',
      active: 'Boolean',
      dec: 'Decimal128',
      nothing: 'Null',
      uuid: 'UUID',
    });
  });

  it('renders values the way Compass does', () => {
    expect(displayValue(doc._id)).toBe("ObjectId('6adedc58761ef473c665d0fb')");
    expect(displayValue(doc.name)).toBe('"Kim"');
    expect(displayValue(doc.score)).toBe("Long('9007199254740993')");
    expect(displayValue(doc.joined)).toBe('2024-03-01T09:00:00.000+00:00');
    expect(displayValue(doc.dec)).toBe("Decimal128('12.34')");
    expect(displayValue(doc.tags)).toBe('Array (2)');
    expect(displayValue([])).toBe('Array (empty)');
    expect(displayValue(doc.addr)).toBe('Object (1)');
    expect(displayValue(doc.uuid)).toBe("UUID('00010203-0405-0607-0809-0a0b0c0d0e0f')");
    expect(displayValue(fromEJSON({ $numberInt: '7' }))).toBe('7');
    expect(displayValue(fromEJSON({ $numberDouble: '2.5' }))).toBe('2.5');
  });

  it('valueKey distinguishes types', () => {
    expect(valueKey(fromEJSON({ $numberLong: '1' }))).not.toBe(valueKey('1'));
  });
});

function find(node: DiffNode, path: string[]): DiffNode | undefined {
  return path.reduce<DiffNode | undefined>((current, key) => current?.children?.find((child) => child.key === key), node);
}

describe('diff', () => {
  const before = fromEJSON({ _id: 1, name: 'Lee', age: { $numberInt: '25' }, tags: ['a', 'b', 'c'], addr: { city: 'Busan' }, gone: true });
  const after = fromEJSON({ _id: 1, name: 'Lee', age: { $numberInt: '26' }, tags: ['a', 'x', 'b', 'c'], addr: { city: 'Busan', zip: '1' }, fresh: 1 });
  const diff = diffDocuments(before, after);

  it('marks leaf changes, additions and removals', () => {
    expect(diff.changeType).toBe('changed');
    expect(find(diff, ['name'])?.changeType).toBe('unchanged');
    expect(find(diff, ['age'])?.changeType).toBe('changed');
    expect(find(diff, ['gone'])?.changeType).toBe('removed');
    expect(find(diff, ['fresh'])?.changeType).toBe('added');
    expect(find(diff, ['addr', 'zip'])?.changeType).toBe('added');
    expect(diff.children?.at(-1)?.key).toBe('fresh');
  });

  it('aligns arrays so an insertion is a single addition', () => {
    const tags = find(diff, ['tags'])?.children?.map((node) => `${node.key}:${node.changeType}`);
    expect(tags).toEqual(['0:unchanged', '1:added', '2:unchanged', '3:unchanged']);
  });

  it('counts changes', () => {
    expect(diffStats(diff)).toEqual({ added: 3, removed: 1, changed: 1 });
  });

  it('treats whole added/removed containers as sticky', () => {
    const node = diffDocuments({}, { nested: { a: [1] } });
    expect(find(node, ['nested', 'a', '0'])?.changeType).toBe('added');
  });

  it('pairs snapshot documents by _id', () => {
    const changes = pairDocuments(
      [{ _id: 1, v: 1 }, { _id: 2, v: 2 }, { _id: 3, v: 3 }],
      [{ _id: 1, v: 10 }, { _id: 2, v: 2 }, { _id: 4, v: 4 }],
    );
    expect(changes.map((change) => change.kind)).toEqual(['modified', 'unchanged', 'deleted', 'inserted']);
  });
});

describe('shell formatting', () => {
  it('prints EJSON inputs as mongosh syntax', () => {
    expect(toShell({ _id: { $oid: '6adedc58761ef473c665d0fb' } })).toBe("{ _id: ObjectId('6adedc58761ef473c665d0fb') }");
    expect(toShell({ 'verb.id': 'x', $or: [{ a: 1 }, { b: { $gt: 2 } }] })).toBe("{ 'verb.id': 'x', $or: [{ a: 1 }, { b: { $gt: 2 } }] }");
    expect(toShell({ at: { $date: '2024-01-01T00:00:00Z' }, n: { $numberLong: '5' } })).toBe(
      "{ at: ISODate('2024-01-01T00:00:00.000Z'), n: NumberLong('5') }",
    );
    expect(toShell({})).toBe('{}');
  });

  it('breaks long documents over lines', () => {
    const text = toShell({ $project: { aaaaaaaaaa: 1, bbbbbbbbbb: 1, cccccccccc: 1, dddddddddd: 1, eeeeeeeeee: 1, ffffffffff: 1 } });
    expect(text.split('\n').length).toBeGreaterThan(3);
    expect(text).toContain('\n    aaaaaaaaaa: 1,');
  });
});

describe('tab title', async () => {
  const { titleFor } = await import('./title');
  it('shows the unseen count only when there is one', () => {
    expect(titleFor(0)).toBe('Herdr DB');
    expect(titleFor(3)).toBe('(3) Herdr DB');
  });
});

describe('rowToggle', () => {
  it('toggles on a plain click and ignores a click that ends a text selection', () => {
    let toggles = 0;
    let selected = '';
    const onClick = rowToggle(() => (toggles += 1), () => selected);
    onClick({} as never);
    expect(toggles).toBe(1);
    selected = "ObjectId('6adedc58')";
    onClick({} as never);
    expect(toggles).toBe(1);
  });
});
