import { bsonTypeOf, entriesOf, isContainer, valueKey, type BsonType } from './bson';

export type ChangeType = 'unchanged' | 'changed' | 'added' | 'removed';

export interface DiffNode {
  key: string;
  changeType: ChangeType;
  left?: unknown;
  right?: unknown;
  leftType?: BsonType;
  rightType?: BsonType;
  /** Set when both sides are the same container type, or the whole container was added/removed. */
  children?: DiffNode[];
  container?: 'Array' | 'Object';
}

const LCS_LIMIT = 300;

function sideOnly(key: string, value: unknown, changeType: 'added' | 'removed'): DiffNode {
  const type = bsonTypeOf(value);
  const side = changeType === 'added' ? { right: value, rightType: type } : { left: value, leftType: type };
  if (!isContainer(type)) return { key, changeType, ...side };
  return {
    key,
    changeType,
    ...side,
    container: type,
    children: entriesOf(value).map(([childKey, child]) => sideOnly(childKey, child, changeType)),
  };
}

function aggregate(children: DiffNode[]): ChangeType {
  return children.some((child) => child.changeType !== 'unchanged') ? 'changed' : 'unchanged';
}

function diffObjectChildren(left: Record<string, unknown>, right: Record<string, unknown>): DiffNode[] {
  const leftKeys = Object.keys(left);
  const rightOnly = Object.keys(right).filter((key) => !(key in left));
  return [
    ...leftKeys.map((key) => (key in right ? diffValues(key, left[key], right[key]) : sideOnly(key, left[key], 'removed'))),
    ...rightOnly.map((key) => sideOnly(key, right[key], 'added')),
  ];
}

/** Longest common subsequence over item keys; returns matched [leftIndex, rightIndex] pairs. */
function lcsPairs(leftKeys: string[], rightKeys: string[]): Array<[number, number]> {
  const n = leftKeys.length;
  const m = rightKeys.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i][j] = leftKeys[i] === rightKeys[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (leftKeys[i] === rightKeys[j]) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

function diffArrayChildren(left: unknown[], right: unknown[]): DiffNode[] {
  if (left.length > LCS_LIMIT || right.length > LCS_LIMIT) {
    const length = Math.max(left.length, right.length);
    return Array.from({ length }, (_, index) => {
      if (index >= right.length) return sideOnly(String(index), left[index], 'removed');
      if (index >= left.length) return sideOnly(String(index), right[index], 'added');
      return diffValues(String(index), left[index], right[index]);
    });
  }

  const pairs = lcsPairs(left.map(valueKey), right.map(valueKey));
  const nodes: DiffNode[] = [];
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [left.length, right.length] as [number, number]]) {
    // Unmatched runs between anchors: pair them up as in-place changes, the rest are removals/additions.
    while (i < pi && j < pj) {
      nodes.push(diffValues(String(j), left[i], right[j]));
      i += 1;
      j += 1;
    }
    while (i < pi) {
      nodes.push(sideOnly(String(i), left[i], 'removed'));
      i += 1;
    }
    while (j < pj) {
      nodes.push(sideOnly(String(j), right[j], 'added'));
      j += 1;
    }
    if (pi < left.length && pj < right.length) {
      nodes.push(diffValues(String(pj), left[pi], right[pj]));
      i = pi + 1;
      j = pj + 1;
    }
  }
  return nodes;
}

export function diffValues(key: string, left: unknown, right: unknown): DiffNode {
  const leftType = bsonTypeOf(left);
  const rightType = bsonTypeOf(right);
  const base = { key, left, right, leftType, rightType };

  if (leftType === rightType && leftType === 'Object') {
    const children = diffObjectChildren(left as Record<string, unknown>, right as Record<string, unknown>);
    return { ...base, container: 'Object', children, changeType: aggregate(children) };
  }
  if (leftType === rightType && leftType === 'Array') {
    const children = diffArrayChildren(left as unknown[], right as unknown[]);
    return { ...base, container: 'Array', children, changeType: aggregate(children) };
  }
  return { ...base, changeType: valueKey(left) === valueKey(right) ? 'unchanged' : 'changed' };
}

export function diffDocuments(before: unknown, after: unknown): DiffNode {
  return diffValues('', before ?? {}, after ?? {});
}

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
}

/** Counts leaf-level changes; a wholly added/removed sub-document counts once. */
export function diffStats(node: DiffNode): DiffStats {
  if (node.changeType === 'added') return { added: 1, removed: 0, changed: 0 };
  if (node.changeType === 'removed') return { added: 0, removed: 1, changed: 0 };
  if (node.changeType === 'unchanged') return { added: 0, removed: 0, changed: 0 };
  if (!node.children) return { added: 0, removed: 0, changed: 1 };
  return node.children.map(diffStats).reduce(
    (total, stats) => ({
      added: total.added + stats.added,
      removed: total.removed + stats.removed,
      changed: total.changed + stats.changed,
    }),
    { added: 0, removed: 0, changed: 0 },
  );
}

export type DocumentChange =
  | { kind: 'modified' | 'unchanged'; id: unknown; diff: DiffNode; stats: DiffStats }
  | { kind: 'deleted'; id: unknown; document: unknown }
  | { kind: 'inserted'; id: unknown; document: unknown };

/** Pairs snapshot documents by _id. */
export function pairDocuments(before: unknown[], after: unknown[]): DocumentChange[] {
  const idOf = (doc: unknown) => (doc as { _id?: unknown })?._id;
  const afterById = new Map(after.map((doc) => [valueKey(idOf(doc)), doc]));
  const beforeIds = new Set(before.map((doc) => valueKey(idOf(doc))));

  const existing: DocumentChange[] = before.map((doc) => {
    const match = afterById.get(valueKey(idOf(doc)));
    if (match === undefined) return { kind: 'deleted', id: idOf(doc), document: doc };
    const diff = diffDocuments(doc, match);
    return { kind: diff.changeType === 'unchanged' ? 'unchanged' : 'modified', id: idOf(doc), diff, stats: diffStats(diff) };
  });
  const upserted: DocumentChange[] = after
    .filter((doc) => !beforeIds.has(valueKey(idOf(doc))))
    .map((doc) => ({ kind: 'inserted', id: idOf(doc), document: doc }));
  return [...existing, ...upserted];
}
