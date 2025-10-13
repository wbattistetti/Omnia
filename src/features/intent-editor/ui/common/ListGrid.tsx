import React, { useEffect, useMemo, useRef, useState } from 'react';

export type ListItem = { id: string; label: string; meta?: any };

export type ListGridProps = {
  items: ListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;

  placeholder?: string;
  addButtonLabel?: string;
  onEnterAdd?: (text: string) => void;

  LeftIcon?: React.ComponentType<{ size?: number; className?: string }>;
  rightSlot?: (item: ListItem) => React.ReactNode;
  rowClassName?: (item: ListItem, selected: boolean) => string;

  sort?: 'alpha' | 'none';
  normalize?: (s: string) => string;
};

const defaultNormalize = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export default function ListGrid({
  items,
  selectedId,
  onSelect,
  placeholder = 'Add…',
  addButtonLabel = '+ New',
  onEnterAdd,
  LeftIcon,
  rightSlot,
  rowClassName,
  sort = 'alpha',
  normalize = defaultNormalize,
}: ListGridProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const list = useMemo(() => {
    if (sort === 'alpha') {
      return [...items].sort((a, b) =>
        normalize(a.label).localeCompare(normalize(b.label), undefined, { sensitivity: 'base' }),
      );
    }
    return items;
  }, [items, sort, normalize]);

  useEffect(() => {
    if (selectedId && rowRefs.current[selectedId]) {
      rowRefs.current[selectedId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedId]);

  const handleAdd = () => {
    const t = value.trim();
    if (!t || !onEnterAdd) return;
    onEnterAdd(t);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-0 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 rounded-lg border px-2 py-1.5">
          {LeftIcon ? <LeftIcon size={16} /> : null}
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            type="text"
            placeholder={placeholder}
            className="flex-1 outline-none text-sm bg-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
        </div>
        {onEnterAdd && (
          <button className="px-2 py-1 text-sm rounded-lg border" onClick={handleAdd}>{addButtonLabel}</button>
        )}
      </div>
      <div className="overflow-auto rounded-xl border">
        <div className="divide-y">
          {list.map(it => {
            const selected = it.id === selectedId;
            const cls = rowClassName ? rowClassName(it, selected) : (selected ? 'bg-amber-50' : 'hover:bg-gray-50');
            return (
              <div
                key={it.id}
                ref={el => (rowRefs.current[it.id] = el)}
                className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${cls}`}
                onClick={() => onSelect(it.id)}
                title={it.label}
              >
                {LeftIcon ? <LeftIcon size={14} /> : null}
                <div className="text-sm flex-1 truncate">{it.label}</div>
                {rightSlot ? rightSlot(it) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


