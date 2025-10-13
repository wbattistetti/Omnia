import React, { useMemo, useRef, useState } from 'react';
import { MessageSquare, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useTestStore } from '../../state/testStore';
import { useIntentStore } from '../../state/intentStore';

export default function TestGrid(){
  const { items, add, remove, markCorrect, markWrong, setFixIntent, setNote } = useTestStore();
  const intents = useIntentStore(s => s.intents);
  const [value, setValue] = useState('');
  const [hoverId, setHoverId] = useState<string|undefined>();
  const [expandedWrongId, setExpandedWrongId] = useState<string|undefined>();
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => items, [items]);

  const handleAdd = () => {
    const t = value.trim();
    if (!t) return;
    add(t);
    setValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-3 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 rounded-lg border px-2 py-1.5">
          <MessageSquare size={16} className="text-slate-500" />
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            type="text"
            placeholder="Aggiungi frase di test…"
            className="flex-1 outline-none text-sm bg-transparent"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
        </div>
        <button className="px-2 py-1 text-sm rounded-lg border" onClick={handleAdd}>+ Add</button>
      </div>

      <div className="overflow-auto rounded-xl border">
        <div className="divide-y">
          {list.map(it => {
            const isHover = hoverId === it.id;
            const LeftIcon = it.status === 'correct' ? CheckCircle2 : (it.status === 'wrong' ? XCircle : MessageSquare);
            const leftColor = it.status === 'correct' ? 'text-green-500' : (it.status === 'wrong' ? 'text-red-500' : 'text-slate-400');
            const isExpanded = expandedWrongId === it.id && it.status === 'wrong';
            return (
              <div key={it.id}
                   className="px-3 py-2"
                   onMouseEnter={() => setHoverId(it.id)}
                   onMouseLeave={() => setHoverId(undefined)}>
                <div className="flex items-center gap-2">
                  <LeftIcon size={16} className={leftColor} />
                  <div className="text-sm flex-1 truncate" title={it.text}>{it.text}</div>
                  {/* hover toolbar */}
                  {isHover && (
                    <div className="flex items-center gap-1">
                      <button
                        className="px-2 py-0.5 text-xs rounded border text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => { markCorrect(it.id); setExpandedWrongId(undefined); }}
                        title="Segna come giusta"
                      >
                        ✓
                      </button>
                      <button
                        className="px-2 py-0.5 text-xs rounded border text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => { markWrong(it.id); setExpandedWrongId(it.id); }}
                        title="Segna come sbagliata"
                      >
                        ✕
                      </button>
                      <button
                        className="px-2 py-0.5 text-xs rounded border text-slate-600 hover:bg-slate-50"
                        onClick={() => remove(it.id)}
                        title="Rimuovi"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <div className="mt-2 pl-6 grid grid-cols-2 gap-2">
                    <select
                      className="w-full px-2 py-1 text-sm rounded border"
                      value={it.fixIntentId || ''}
                      onChange={e => setFixIntent(it.id, e.target.value || undefined)}
                    >
                      <option value="">Seleziona intent…</option>
                      {intents.map(ix => (
                        <option key={ix.id} value={ix.id}>{ix.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Commento…"
                      className="w-full px-2 py-1 text-sm rounded border"
                      value={it.note || ''}
                      onChange={e => setNote(it.id, e.target.value)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


