import { useState } from 'react';
import { bsonTypeOf, entriesOf, isContainer } from '../lib/bson';
import { BsonValue } from './BsonValue';
import { CaretIcon } from './icons';

// Compass shows the first 25 fields and reveals the rest on demand.
const INITIAL_FIELDS = 25;
const INDENT = 16;

type Tone = 'added' | 'removed' | undefined;

function ShowMore({ hidden, level, onShow }: { hidden: number; level: number; onShow: () => void }) {
  if (hidden <= 0) return null;
  return (
    <div style={{ paddingLeft: 4 + INDENT * (level + 1) }}>
      <button type="button" className="show-more" onClick={onShow}>
        Show {hidden} more {hidden === 1 ? 'field' : 'fields'}
      </button>
    </div>
  );
}

function Fields({ value, level, tone, isArray }: { value: unknown; level: number; tone: Tone; isArray: boolean }) {
  const [visible, setVisible] = useState(INITIAL_FIELDS);
  const entries = entriesOf(value);
  return (
    <>
      {entries.slice(0, visible).map(([key, child]) => (
        <Element key={key} name={key} value={child} level={level} tone={tone} isIndex={isArray} />
      ))}
      <ShowMore hidden={entries.length - visible} level={level - 1} onShow={() => setVisible((n) => n + 1000)} />
    </>
  );
}

function Element({ name, value, level, tone, isIndex }: { name: string; value: unknown; level: number; tone: Tone; isIndex: boolean }) {
  const type = bsonTypeOf(value);
  const expandable = isContainer(type) && entriesOf(value).length > 0;
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`element${tone ? ` is-${tone}` : ''}`}>
        <div style={{ width: INDENT * level, flex: 'none' }} />
        <div className="element-expand">
          {expandable && (
            <button type="button" className="caret" aria-expanded={open} aria-label={open ? 'Collapse field items' : 'Expand field items'} onClick={() => setOpen(!open)}>
              <CaretIcon open={open} />
            </button>
          )}
        </div>
        <div className="element-content">
          <span className={`element-key${isIndex ? ' is-index' : ''}`}>{name}</span>
          <span>:&nbsp;</span>
          <BsonValue value={value} type={type} />
        </div>
      </div>
      {expandable && open && <Fields value={value} level={level + 1} tone={tone} isArray={type === 'Array'} />}
    </>
  );
}

/** Read-only Compass document: bold keys, typed colored values, collapsible sub-documents. */
export function DocumentView({ doc, tone }: { doc: unknown; tone?: Tone }) {
  return (
    <div className="hadron-document">
      <Fields value={doc} level={0} tone={tone} isArray={false} />
    </div>
  );
}
