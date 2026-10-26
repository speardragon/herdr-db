import { useState } from 'react';
import type { DiffNode } from '../lib/diff';
import { BsonValue } from './BsonValue';
import { CaretIcon } from './icons';

function markOf(changeType: DiffNode['changeType']) {
  if (changeType === 'added') return 'mark-added';
  if (changeType === 'removed') return 'mark-removed';
  return undefined;
}

function Leaf({ node }: { node: DiffNode }) {
  const showLeft = node.changeType !== 'added';
  const showRight = node.changeType === 'changed' || node.changeType === 'added';
  return (
    <span className="change-values">
      {showLeft && (
        <span className={node.changeType === 'changed' || node.changeType === 'removed' ? 'mark-removed' : undefined}>
          <BsonValue value={node.left} type={node.leftType} />
        </span>
      )}
      {showRight && (
        <span className="mark-added">
          <BsonValue value={node.right} type={node.rightType} />
        </span>
      )}
    </span>
  );
}

function Branch({ node }: { node: DiffNode }) {
  // Changed branches start open, like Compass's bulk-update preview.
  const [open, setOpen] = useState(node.changeType !== 'unchanged');
  const mark = markOf(node.changeType);
  const label = node.container === 'Array' ? 'Array' : 'Object';
  return (
    <div>
      <div className="change-row">
        <button type="button" className="caret" aria-expanded={open} onClick={() => setOpen(!open)}>
          <CaretIcon open={open} />
        </button>
        <span className={['change-key', mark].filter(Boolean).join(' ')}>{node.key}:</span>
        <span className={mark}>{label}</span>
      </div>
      {open && <Children nodes={node.children ?? []} />}
    </div>
  );
}

function Row({ node }: { node: DiffNode }) {
  if (node.children) return <Branch node={node} />;
  return (
    <div className="change-row change-leaf">
      <span className={['change-key', markOf(node.changeType)].filter(Boolean).join(' ')}>{node.key}:</span>
      <Leaf node={node} />
    </div>
  );
}

function Children({ nodes }: { nodes: DiffNode[] }) {
  return (
    <div className="change-children">
      {nodes.map((child) => (
        <Row key={`${child.key}:${child.changeType}`} node={child} />
      ))}
    </div>
  );
}

/** Unified before/after tree: removed values in red, added in green, unchanged plain. */
export function ChangeView({ diff }: { diff: DiffNode }) {
  return (
    <div className="change-view">
      {(diff.children ?? []).map((child) => (
        <Row key={`${child.key}:${child.changeType}`} node={child} />
      ))}
    </div>
  );
}
