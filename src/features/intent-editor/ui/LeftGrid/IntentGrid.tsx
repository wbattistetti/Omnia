import React, { useEffect, useMemo, useRef } from 'react';
import { GitBranch } from 'lucide-react';
import type { Intent } from '../../types/types';
import { normalizeName } from '../../utils/normalize';

type Props = {
  items: Intent[];
  selectedId?: string;
  onEnterAddOrFocus: (name: string) => void;
  onSelect: (id: string) => void;
};

export function IntentGrid({ items, selectedId, onEnterAddOrFocus, onSelect }: Props){
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const list = useMemo(() => {
    return [...items].sort((a,b) =>
      normalizeName(a.name).localeCompare(normalizeName(b.name), undefined, { sensitivity: 'base' })
    );
  }, [items]);

  useEffect(() => {
    if (selectedId && rowRefs.current[selectedId]) {
      rowRefs.current[selectedId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedId]);

  const handleEnter = () => {
    const v = (inputRef.current?.value || '').trim();
    if (v) {
      onEnterAddOrFocus(v);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-3 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 rounded-lg border px-2 py-1.5">
          <GitBranch size={16} className="text-amber-600" />
          <input
          ref={inputRef}
          type="text"
          placeholder="Add or find a problem…"
          className="flex-1 outline-none text-sm bg-transparent"
          onKeyDown={(e) => { if (e.key === 'Enter') handleEnter(); }}
          />
        </div>
        <button className="px-2 py-1 text-sm rounded-lg border" onClick={handleEnter}>+ New</button>
      </div>
      <div className="overflow-auto rounded-xl border">
        <div className="divide-y">
          {list.map(it => (
            <div
              key={it.id}
              ref={el => (rowRefs.current[it.id] = el)}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${it.id === selectedId ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
              onClick={() => onSelect(it.id)}
              title={it.name}
            >
              <GitBranch size={14} className="text-amber-600" />
              <div className="text-sm">{it.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


