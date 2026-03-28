import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export type ListItem = { id: string; label: string; meta?: any };

export type ListGridProps = {
  items: ListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;

  placeholder?: string;
  addButtonLabel?: string;
  onEnterAdd?: (text: string) => void;

  LeftIcon?: React.ComponentType<{ size?: number; className?: string }>;
  labelAddon?: (item: ListItem) => React.ReactNode;
  labelRenderer?: (item: ListItem) => React.ReactNode; // ✅ Renderer personalizzato per il label
  rightSlot?: (item: ListItem) => React.ReactNode;
  rowClassName?: (item: ListItem, selected: boolean) => string;

  sort?: 'alpha' | 'none';
  normalize?: (s: string) => string;
  onEditItem?: (id: string, newLabel: string, prevLabel: string) => void;
  onDeleteItem?: (id: string) => void;
  highlightedId?: string | null; // ✅ ID dell'item da evidenziare con sfondo pastello
  // ✅ Nuove props per checkbox enabled/disabled
  itemEnabled?: (item: ListItem) => boolean;
  onToggleEnabled?: (id: string) => void;
  /** When false, intent labels wrap and show in full (embeddings left column). Default true for compact lists. */
  truncateLabels?: boolean;
  /** Renders below the main row (e.g. intent description). Clicks should call stopPropagation where needed. */
  rowFooter?: (item: ListItem) => React.ReactNode;
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
  labelAddon,
  labelRenderer,
  rightSlot,
  rowClassName,
  sort = 'alpha',
  normalize = defaultNormalize,
  onEditItem,
  onDeleteItem,
  highlightedId,
  itemEnabled, // ✅ Nuova prop
  onToggleEnabled, // ✅ Nuova prop
  truncateLabels = true,
  rowFooter,
}: ListGridProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

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
    if (!t || !onEnterAdd) return false;
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('debug.semanticValues') === '1') {
        console.debug('[ListGrid] add via input', { text: t, length: t.length });
      }
    } catch {}
    onEnterAdd(t);
    setValue('');
    inputRef.current?.focus();
    return true;
  };

  const beginEdit = (id: string, label: string) => {
    setEditingId(id);
    setEditValue(label);
  };
  const commitEdit = (id: string, prev: string) => {
    const next = editValue.trim();
    setEditingId(null);
    if (!next || next === prev) return;
    if (onEditItem) onEditItem(id, next, prev);
  };
  const cancelEdit = () => {
    setEditingId(null);
  };

  // ✅ SOLUZIONE ESPERTO: Rimuovere h-full, usare solo flex-1 min-h-0
  return (
  <div className="bg-white border rounded-2xl shadow-sm p-0 flex flex-col flex-1 min-h-0">
      {/* ✅ INPUT FISSO IN ALTO - fuori dall'area scrollabile */}
      <div className="flex items-center gap-2 p-3 flex-shrink-0 border-b">
        <div className="flex items-center gap-2 flex-1 rounded-lg border px-2 py-1.5">
          {LeftIcon ? <LeftIcon size={16} /> : null}
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            type="text"
            placeholder={placeholder}
            className="flex-1 outline-none bg-transparent"
            onKeyDownCapture={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              e.stopPropagation();
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              e.stopPropagation();
              handleAdd();
            }}
            onKeyUp={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              e.stopPropagation();
              handleAdd();
            }}
          />
        </div>
        {onEnterAdd && (
          <button type="button" className="px-2 py-1 rounded-lg border" onClick={handleAdd}>{addButtonLabel}</button>
        )}
      </div>
      {/* ✅ LISTA SCROLLABILE - solo questa parte scrolla */}
      <div
        className={`overflow-y-auto min-h-0 flex-1 px-3 pb-3 ${
          truncateLabels ? 'overflow-x-hidden' : 'overflow-x-auto'
        }`}
      >
        <div className="divide-y border rounded-xl">
          {list.map(it => {
            const selected = it.id === selectedId;
            const highlighted = it.id === highlightedId;
            const enabled = itemEnabled ? itemEnabled(it) : true; // ✅ Default enabled se non specificato

            // ✅ Sfondo pastello per l'item evidenziato (verde pastello)
            const highlightCls = highlighted ? 'bg-green-100 animate-pulse' : '';
            const cls = rowClassName
              ? rowClassName(it, selected)
              : (selected ? 'bg-amber-50' : 'hover:bg-gray-50');

            // ✅ Stile grigio quando disabilitato
            const disabledCls = !enabled ? 'opacity-50 grayscale text-gray-400' : '';

            return (
              <div
                key={it.id}
                data-item-id={it.id}
                ref={el => (rowRefs.current[it.id] = el)}
                className={`${cls} ${highlightCls} ${disabledCls} group transition-all duration-300`}
              >
                <div
                  className={`px-3 py-2 cursor-pointer flex gap-2 ${
                    truncateLabels ? 'items-center' : 'items-start'
                  }`}
                  onClick={() => onSelect(it.id)}
                  title={it.label}
                >
                  {/* ✅ Checkbox per enable/disable */}
                  {onToggleEnabled && (
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        e.stopPropagation(); // ✅ Previene il click sulla riga
                        onToggleEnabled(it.id);
                      }}
                      onClick={(e) => e.stopPropagation()} // ✅ Doppia sicurezza
                      className="cursor-pointer shrink-0"
                      title={enabled ? 'Disattiva intento' : 'Attiva intento'}
                    />
                  )}

                  {LeftIcon ? (
                    <LeftIcon size={14} className={truncateLabels ? '' : 'shrink-0 mt-0.5'} />
                  ) : null}
                  <div
                    className={`flex-1 flex gap-2 min-w-0 ${
                      truncateLabels ? 'truncate items-center' : 'items-start flex-wrap'
                    }`}
                  >
                    {editingId === it.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={e=> setEditValue(e.target.value)}
                        onKeyDown={(e)=>{
                          if (e.key === 'Enter') commitEdit(it.id, it.label);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        onBlur={()=> commitEdit(it.id, it.label)}
                        className="w-full bg-transparent outline-none border-b border-amber-300"
                      />
                    ) : (
                      <>
                        <span className={truncateLabels ? 'truncate' : 'whitespace-normal break-words'}>
                          {labelRenderer ? labelRenderer(it) : it.label}
                        </span>
                        {labelAddon && (
                          <span className="shrink-0">{labelAddon(it)}</span>
                        )}
                      </>
                    )}
                  </div>
                  {rightSlot ? rightSlot(it) : null}
                  {(onEditItem || onDeleteItem) && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {onEditItem && (
                        <button
                          className="p-1 rounded hover:bg-amber-100"
                          title="Edit"
                          onClick={(e)=>{ e.stopPropagation(); beginEdit(it.id, it.label); }}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {onDeleteItem && (
                        <button
                          className="p-1 rounded hover:bg-rose-100"
                          title="Delete"
                          onClick={(e)=>{ e.stopPropagation(); onDeleteItem(it.id); }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {rowFooter ? (
                  <div
                    className="px-3 pb-2 pl-[52px] border-t border-transparent"
                    onClick={e => e.stopPropagation()}
                  >
                    {rowFooter(it)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


