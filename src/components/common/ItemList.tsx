import React, { useEffect, useMemo, useRef } from 'react';
import type { ListItem } from '../../features/intent-editor/ui/common/ListGrid';

export interface ItemListProps<T extends ListItem = ListItem> {
  items: T[];
  selectedId?: string | null;
  onSelect: (id: string) => void;

  LeftIcon?: React.ComponentType<{ size?: number; className?: string }>;
  labelAddon?: (item: T) => React.ReactNode;
  labelRenderer?: (item: T) => React.ReactNode;
  getBadge?: (item: T) => string | number; // Opzionale: badge per conteggio frasi, etc.

  sort?: 'alpha' | 'none';
  normalize?: (s: string) => string;
  rowClassName?: (item: T, selected: boolean) => string;
}

const defaultNormalize = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Generic read-only list component for selecting items
 * Used in EmbeddingEditor for intent selection (no editing)
 */
export default function ItemList<T extends ListItem = ListItem>({
  items,
  selectedId,
  onSelect,
  LeftIcon,
  labelAddon,
  labelRenderer,
  getBadge,
  sort = 'alpha',
  normalize = defaultNormalize,
  rowClassName,
}: ItemListProps<T>) {
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

  return (
    <div className="border border-amber-300 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full min-h-0">
      {/* Header semplice - solo titolo (no controlli di editing) */}
      <div className="px-3 py-2 bg-amber-200 text-slate-900 font-semibold border-b">
        <span>Intents</span>
      </div>

      {/* Lista scrollabile - solo visualizzazione */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
        <div className="overflow-y-auto overflow-x-hidden min-h-0 flex-1 px-3 pb-3">
          <div className="divide-y border rounded-xl">
            {list.length === 0 ? (
              <div className="px-3 py-8 text-center text-gray-400 text-sm">
                No items available
              </div>
            ) : (
              list.map(it => {
                const selected = it.id === selectedId;
                const cls = rowClassName
                  ? rowClassName(it, selected)
                  : (selected ? 'bg-amber-50' : 'hover:bg-gray-50');
                const badge = getBadge ? getBadge(it) : null;

                return (
                  <div
                    key={it.id}
                    data-item-id={it.id}
                    ref={el => (rowRefs.current[it.id] = el)}
                    className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${cls} group transition-all`}
                    onClick={() => onSelect(it.id)}
                    title={it.label}
                  >
                    {LeftIcon ? <LeftIcon size={14} /> : null}
                    <div className="flex-1 truncate flex items-center gap-2">
                      <span className="truncate">
                        {labelRenderer ? labelRenderer(it) : it.label}
                      </span>
                      {labelAddon && (
                        <span className="shrink-0">{labelAddon(it)}</span>
                      )}
                      {badge !== null && (
                        <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 shrink-0">
                          {badge}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

