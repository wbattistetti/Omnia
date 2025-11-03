import React, { useMemo, useRef, useState, useEffect } from 'react';
import { MessageSquare, Check, X, Trash2 } from 'lucide-react';
import { useTestStore } from '../../state/testStore';
import { useIntentStore } from '../../state/intentStore';

type TestMode = 'training' | 'new';

export default function TestGrid({
  intentId,
  modelReady: initialModelReady,
  mode: externalMode,
  setMode: externalSetMode
}: {
  intentId?: string;
  modelReady?: boolean;
  mode?: 'training' | 'new';
  setMode?: (mode: 'training' | 'new') => void;
}){
  const { items, add, remove, markCorrect, markWrong, setFixIntent, setNote } = useTestStore();
  const intents = useIntentStore(s => s.intents);
  const selectedIntent = intentId ? intents.find(i => i.id === intentId) : undefined;

  // Usa mode esterno se fornito, altrimenti usa stato interno
  const [internalMode, setInternalMode] = useState<TestMode>('new');
  const mode = externalMode !== undefined ? externalMode : internalMode;
  const setMode = externalSetMode || setInternalMode;
  const [value, setValue] = useState('');
  const [hoverId, setHoverId] = useState<string|undefined>();
  const [expandedWrongId, setExpandedWrongId] = useState<string|undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelReady] = useState(initialModelReady || false);
  // ✅ Risultati test per frasi di training (non sono in testStore)
  const [trainingResults, setTrainingResults] = useState<Map<string, { status: 'unknown' | 'correct' | 'wrong'; predictedIntentId?: string; score?: number }>>(new Map());

  // ✅ Lista frasi in base al mode
  const displayedList = useMemo(() => {
    if (mode === 'training') {
      // Mostra frasi di training (positive + negative)
      if (!selectedIntent) return [];
      const trainingPhrases = [
        ...(selectedIntent.variants.curated || []).map(p => ({
          id: `train_pos_${p.id}`,
          text: p.text,
          status: 'unknown' as const,
          isTraining: true,
          type: 'matching' as const
        })),
        ...(selectedIntent.variants.hardNeg || []).map(p => ({
          id: `train_neg_${p.id}`,
          text: p.text,
          status: 'unknown' as const,
          isTraining: true,
          type: 'not-matching' as const
        }))
      ];
      return trainingPhrases;
    } else {
      // Mostra frasi nuove (testStore)
      return items;
    }
  }, [mode, selectedIntent, items]);

  // ✅ Espone la lista visibile al parent per Run test
  useEffect(() => {
    // Aggiorna lista globale per Run test nell'header
    (window as any).__testGridVisibleItems = displayedList.map(it => ({ id: it.id, text: it.text }));
  }, [displayedList]);

  // ✅ Listener per risultati test delle frasi di training
  useEffect(() => {
    const handleTrainingResult = (e: CustomEvent) => {
      const { id, status, predictedIntentId, score } = e.detail;
      setTrainingResults(prev => {
        const next = new Map(prev);
        next.set(id, { status, predictedIntentId, score });
        return next;
      });
    };

    window.addEventListener('trainingTestResult' as any, handleTrainingResult);
    return () => {
      window.removeEventListener('trainingTestResult' as any, handleTrainingResult);
    };
  }, []);

  const handleAdd = () => {
    if (mode !== 'new') return; // Solo in modalità new phrases
    const t = value.trim();
    if (!t) return;
    add(t);
    setValue('');
    inputRef.current?.focus();
  };

  // ✅ Gestione rimozione (solo per new phrases)
  const handleRemove = (id: string) => {
    if (mode === 'training') return; // Non rimuovere frasi di training
    remove(id);
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-3 flex flex-col h-full">

      {/* ✅ Input solo per new phrases */}
      {mode === 'new' && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 rounded-lg border px-2 py-1.5">
            <MessageSquare size={16} className="text-slate-500" />
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              type="text"
              placeholder="Aggiungi frase di test…"
              className="flex-1 outline-none bg-transparent"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <button className="px-2 py-1 rounded-lg border" onClick={handleAdd}>+ Add</button>
        </div>
      )}

      {/* ✅ Lista frasi */}
      <div className="overflow-auto rounded-xl border flex-1 min-h-0">
        <div className="divide-y">
          {displayedList.length === 0 ? (
            <div className="px-3 py-4 text-center text-gray-500">
              {mode === 'training' ? 'Nessuna frase di training disponibile' : 'Nessuna frase di test. Aggiungine una sopra.'}
            </div>
          ) : (
            displayedList.map(it => {
              const isHover = hoverId === it.id;
              const isTraining = (it as any).isTraining;

              // ✅ Per training phrases, usa risultati locali; per new phrases usa testStore
              const actualStatus = isTraining
                ? (trainingResults.get(it.id)?.status || it.status)
                : it.status;

              const LeftIcon = actualStatus === 'correct' ? Check : (actualStatus === 'wrong' ? X : MessageSquare);
              const leftColor = actualStatus === 'correct' ? 'text-green-600' : (actualStatus === 'wrong' ? 'text-red-600' : 'text-slate-400');
              const textColor = actualStatus === 'correct' ? 'text-green-600' : (actualStatus === 'wrong' ? 'text-red-600' : '');
              const isExpanded = expandedWrongId === it.id && actualStatus === 'wrong';

              return (
                <div key={it.id}
                     className="px-3 py-2"
                     onMouseEnter={() => setHoverId(it.id)}
                     onMouseLeave={() => setHoverId(undefined)}>
                  <div className="flex items-center gap-2">
                    <LeftIcon size={18} className={leftColor} />
                    <div className={`flex-1 truncate ${textColor}`} title={it.text}>{it.text}</div>
                    {isTraining && mode === 'training' && (
                      <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                        (it as any).type === 'matching' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {(it as any).type === 'matching' ? 'M' : 'N'}
                      </span>
                    )}
                    {/* hover toolbar */}
                    {isHover && !isTraining && (
                      <div className="flex items-center gap-1">
                        <button
                          className="px-2 py-0.5 rounded border text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => { markCorrect(it.id); setExpandedWrongId(undefined); }}
                          title="Segna come giusta"
                        >
                          ✓
                        </button>
                        <button
                          className="px-2 py-0.5 rounded border text-red-700 border-red-300 hover:bg-red-50"
                          onClick={() => { markWrong(it.id); setExpandedWrongId(it.id); }}
                          title="Segna come sbagliata"
                        >
                          ✕
                        </button>
                        <button
                          className="px-2 py-0.5 rounded border text-slate-600 hover:bg-slate-50"
                          onClick={() => handleRemove(it.id)}
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
                        className="w-full px-2 py-1 rounded border"
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
                        className="w-full px-2 py-1 rounded border"
                        value={it.note || ''}
                        onChange={e => setNote(it.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
