import React, { useEffect, useMemo, useState } from 'react';
import ListGrid from '../common/ListGrid';
import { MessageSquare } from 'lucide-react';

type Phrase = { id: string; text: string };

export default function PhrasesPanel({
  intentName,
  intentId,
  lang = 'pt',
  positive,
  negative,
  keywords,
  onAddPositive,
  onAddNegative,
  onAddKeyword,
  onClearPositive,
  onClearNegative,
  onClearKeywords,
  onTest,
  tab: externalTab,
  setTab: externalSetTab
}: {
  intentName: string;
  intentId: string; // ✅ Necessario per training
  lang?: 'it'|'en'|'pt';
  positive: Phrase[];
  negative: Phrase[];
  keywords: { id: string; term: string }[];
  onAddPositive: (t: string) => void;
  onAddNegative: (t: string) => void;
  onAddKeyword: (t: string) => void;
  onClearPositive?: () => void;
  onClearNegative?: () => void;
  onClearKeywords?: () => void;
  onTest?: () => Promise<void> | void;
  tab?: 'pos'|'neg'|'key';
  setTab?: (tab: 'pos'|'neg'|'key') => void;
}){
  // Usa tab esterno se fornito, altrimenti usa stato interno
  const [internalTab, setInternalTab] = useState<'pos'|'neg'|'key'>('pos');
  const tab = externalTab !== undefined ? externalTab : internalTab;
  const setTab = externalSetTab || setInternalTab;

  // ✅ State per risultati test (correct/wrong) per colorazione frasi
  const [testResults, setTestResults] = useState<Map<string, 'correct' | 'wrong'>>(new Map());

  // ✅ Ascolta evento 'trainingTestResult' per aggiornare colorazione
  useEffect(() => {
    const handleTrainingResult = (e: any) => {
      const { id, status } = e.detail || {};
      if (id && (status === 'correct' || status === 'wrong')) {
        setTestResults(prev => {
          const next = new Map(prev);
          next.set(id, status);
          return next;
        });
      }
    };

    window.addEventListener('trainingTestResult' as any, handleTrainingResult);
    return () => {
      window.removeEventListener('trainingTestResult' as any, handleTrainingResult);
    };
  }, []);

  // ✅ Funzione per className delle righe (solo selected, niente colorazione)
  const getRowClassName = (item: { id: string; label: string }, selected: boolean): string => {
    return selected ? 'bg-amber-50' : 'hover:bg-gray-50';
  };

  // ✅ Funzione per renderizzare il label con badge colorato quando c'è un risultato test
  const renderLabelWithBadge = (item: { id: string; label: string }) => {
    const result = testResults.get(item.id);
    if (result === 'correct') {
      return (
        <span className="px-2 py-0.5 rounded-md border border-green-500 bg-green-50/70 text-green-700">
          {item.label}
        </span>
      );
    } else if (result === 'wrong') {
      return (
        <span className="px-2 py-0.5 rounded-md border border-red-500 bg-red-50/70 text-red-700">
          {item.label}
        </span>
      );
    }
    return item.label;
  };

  const posItems = useMemo(()=> positive.map(p=>({ id: p.id, label: p.text })), [positive]);
  const negItems = useMemo(()=> negative.map(p=>({ id: p.id, label: p.text })), [negative]);
  const keyItems = useMemo(()=> keywords.map(k=>({ id: k.id, label: k.term })), [keywords]);
  const allExisting = useMemo(() => {
    const all = [...posItems, ...negItems, ...keyItems];
    const norm = (s: string) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    const seen = new Set<string>();
    const out: string[] = [];
    for (const i of all) {
      const n = norm(i.label);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(i.label);
    }
    return out;
  }, [posItems, negItems, keyItems]);

  useEffect(() => {
    try {
      if (localStorage.getItem('debug.intent') === '1') {
        console.log('[PhrasesPanel][mount]', { tab, positive: posItems.length, negative: negItems.length, keywords: keyItems.length });
      }
    } catch {}
  }, [tab, posItems.length, negItems.length, keyItems.length]);

  const norm = (s: string) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  const existsIn = (label: string, list: { id: string; label: string }[]) => list.find(i=>norm(i.label)===norm(label));


  return (
    <div className="mt-2 flex flex-col min-h-0 h-full overflow-hidden">
      {/* List area - ListGrid gestisce internamente input fisso e lista scrollabile */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab==='pos' && (
          <ListGrid
            items={posItems}
            onSelect={()=>{}}
            placeholder="Aggiungi frase (matching)…"
            addButtonLabel="+"
            onEditItem={(id,newLabel)=>{ /* map id->label; here we just add new and remove old */
              const prev = posItems.find(p=>p.id===id)?.label;
              if (!prev) return;
              // naive: replace text by removing/adding
              // caller store functions expect only add; editing flow can be refined later
              if (!existsIn(newLabel, posItems)) onAddPositive(newLabel);
            }}
            onDeleteItem={(id)=>{
              // temporary: no dedicated delete in store; ignore here.
              // Deletion should be handled by parent store (future work).
            }}
            onEnterAdd={(text)=>{
              // dedup locale e cross-tab
              if (existsIn(text, posItems)) return; // TODO: scroll a item
              if (existsIn(text, negItems)) { setTab('neg'); return; }
              onAddPositive(text);
            }}
            LeftIcon={()=>(<MessageSquare size={14} className="text-emerald-600" />)}
            sort="alpha"
            rowClassName={getRowClassName}
            labelRenderer={renderLabelWithBadge}
          />
        )}
        {tab==='neg' && (
          <ListGrid
            items={negItems}
            onSelect={()=>{}}
            placeholder="Aggiungi frase (not matching)…"
            addButtonLabel="+"
            onEditItem={(id,newLabel)=>{
              const prev = negItems.find(p=>p.id===id)?.label;
              if (!prev) return;
              if (!existsIn(newLabel, negItems)) onAddNegative(newLabel);
            }}
            onDeleteItem={(id)=>{}}
            onEnterAdd={(text)=>{
              if (existsIn(text, negItems)) return;
              if (existsIn(text, posItems)) { setTab('pos'); return; }
              onAddNegative(text);
            }}
            LeftIcon={()=>(<MessageSquare size={14} className="text-rose-600" />)}
            sort="alpha"
            rowClassName={getRowClassName}
            labelRenderer={renderLabelWithBadge}
          />
        )}
        {tab==='key' && (
          <ListGrid
            items={keyItems}
            onSelect={()=>{}}
            placeholder="Aggiungi keyword…"
            addButtonLabel="+"
            onEditItem={(id,newLabel)=>{
              const prev = keyItems.find(p=>p.id===id)?.label;
              if (!prev) return;
              if (!existsIn(newLabel, keyItems)) onAddKeyword(newLabel);
            }}
            onDeleteItem={(id)=>{}}
            onEnterAdd={(text)=>{
              if (existsIn(text, keyItems)) return;
              onAddKeyword(text);
            }}
            LeftIcon={()=>(<MessageSquare size={14} className="text-indigo-600" />)}
            sort="alpha"
          />
        )}
      </div>
    </div>
  );
}


