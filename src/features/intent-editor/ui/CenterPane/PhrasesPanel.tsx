import React, { useEffect, useMemo, useState } from 'react';
import ListGrid from '../common/ListGrid';
import { CheckCircle, XCircle, MessageSquare, Tag, Sparkles, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { generateVariantsForIntent } from '../../services/variantsService';
import { ImportDropdown } from '../common/ImportDropdown';

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
  onTest
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
}){
  const [tab, setTab] = useState<'pos'|'neg'|'key'>('pos');
  const [loading, setLoading] = useState(false);
  const [genN, setGenN] = useState<number>(10);
  const [lastGen, setLastGen] = useState<{ count: number; requested: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // ✅ Handler per import frasi - aggiunge al tab corrente
  const handleImportPhrases = (values: string[]) => {
    let added = 0;
    let duplicates = 0;
    for (const value of values) {
      if (tab === 'pos') {
        if (!existsIn(value, posItems) && !existsIn(value, negItems)) {
          onAddPositive(value);
          added++;
        } else {
          duplicates++;
        }
      } else if (tab === 'neg') {
        if (!existsIn(value, negItems) && !existsIn(value, posItems)) {
          onAddNegative(value);
          added++;
        } else {
          duplicates++;
        }
      } else if (tab === 'key') {
        if (!existsIn(value, keyItems)) {
          onAddKeyword(value);
          added++;
        } else {
          duplicates++;
        }
      }
    }
    // Messaggio personalizzato se ci sono duplicati
    if (duplicates > 0) {
      alert(`Importate ${added} frasi (${duplicates} duplicate ignorate)`);
    }
  };

  // ✅ Handler per Clear - svuota tutte le frasi del tab corrente (senza conferma)
  const handleClear = () => {
    if (tab === 'pos') {
      if (positive.length === 0) return;
      onClearPositive?.();
    } else if (tab === 'neg') {
      if (negative.length === 0) return;
      onClearNegative?.();
    } else if (tab === 'key') {
      if (keywords.length === 0) return;
      onClearKeywords?.();
    }
  };

  // Conta le frasi per il tab corrente (per disabilitare il pulsante se vuoto)
  const currentTabCount = tab === 'pos' ? positive.length : tab === 'neg' ? negative.length : keywords.length;


  return (
    <div className="mt-2 flex flex-col min-h-0 h-full">
      {/* Tabs row tight under header */}
      <div className="flex items-center gap-2 border-b group mb-2">
        <button className={`px-3 py-1.5 text-sm flex items-center gap-2 ${tab==='pos'?'bg-emerald-100':''}`} onClick={()=>setTab('pos')}>
          <CheckCircle size={16} className="text-emerald-600" /> <span>Matching</span>
        </button>
        <button className={`px-3 py-1.5 text-sm flex items-center gap-2 ${tab==='neg'?'bg-rose-100':''}`} onClick={()=>setTab('neg')}>
          <XCircle size={16} className="text-rose-600" /> <span>Not matching</span>
        </button>
        <button className={`px-3 py-1.5 text-sm flex items-center gap-2 ${tab==='key'?'bg-indigo-100':''}`} onClick={()=>setTab('key')}>
          <Tag size={16} className="text-indigo-600" /> <span>Keywords</span>
        </button>
        {/* controls a destra: numero da generare + generate, 20px dopo Keywords */}
        <div className={`ml-auto flex items-center gap-2 pl-5 ${loading ? '' : ''}`}
          style={{ opacity: tab ? 1 : undefined }}>
          <input
            type="number"
            min={1}
            max={50}
            value={genN}
            onChange={e=> setGenN(Math.max(1, Math.min(50, Number(e.target.value)||1)))}
            className={`w-14 px-2 py-1 text-xs rounded-md border ${tab ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}
            title="Numero di frasi da generare"
          />
          {/* ✅ ImportDropdown per importare frasi */}
          <ImportDropdown
            onImport={handleImportPhrases}
            buttonLabel="Import Phrases"
            successMessage={(count) => `Importate ${count} frasi`}
            errorMessage={{
              clipboard: 'Errore durante la lettura del clipboard',
              file: 'Errore durante la lettura del file',
              empty: 'Nessuna frase valida trovata'
            }}
          />
          <button
            className={`${tab? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'} px-2 py-1 text-xs rounded-md border flex items-center gap-1 ${error ? 'text-red-600 border-red-300' : ''}`}
          title={error ? error : (loading ? 'Generating…' : 'Genera suggerimenti')}
          disabled={loading}
          onClick={async ()=>{
            try {
              setLoading(true);
              setError(null); // ✅ Reset errore
              setLastGen(null);
              const requested = genN;
              // Send ALL phrases currently in the grids as explicit "do not repeat"
              const exclude = allExisting;
              const kind = tab==='pos' ? 'positive' : tab==='neg' ? 'negative' : 'keywords';
              const generated = await generateVariantsForIntent({ intentName, kind: kind as any, exclude, n: requested, lang });
              let added = 0;
              for (const g of generated) {
                if (tab==='pos') { if (!existsIn(g, posItems) && !existsIn(g, negItems)) { onAddPositive(g); added++; } }
                if (tab==='neg') { if (!existsIn(g, negItems) && !existsIn(g, posItems)) { onAddNegative(g); added++; } }
                if (tab==='key') { if (!existsIn(g, keyItems)) { onAddKeyword(g); added++; } }
              }
              setLastGen({ count: added, requested });
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione';
              setError(errorMsg); // ✅ Salva errore
              console.error('[PhrasesPanel] Generation error:', err);
            } finally {
              setLoading(false);
            }
          }}
          >
            {loading ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generate
              </span>
            ) : error ? (
              <span className="flex items-center gap-1">
                <AlertTriangle size={14} className="text-red-600" /> Generate
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles size={14} /> Generate
              </span>
            )}
          </button>
          {!loading && lastGen && (
            <span
              className={[
                'px-2 py-0.5 text-xs rounded border',
                lastGen.count === 0 ? 'bg-rose-100 text-rose-700 border-rose-200' :
                lastGen.count < lastGen.requested ? 'bg-amber-100 text-amber-800 border-amber-200' :
                'bg-emerald-100 text-emerald-700 border-emerald-200'
              ].join(' ')}
              title={`Generated ${lastGen.count} of ${lastGen.requested}`}
              aria-live="polite"
            >
              {lastGen.count}/{lastGen.requested}
            </span>
          )}
          {/* ✅ Pulsante Clear per svuotare tutte le frasi del tab corrente */}
          <button
            onClick={handleClear}
            disabled={currentTabCount === 0}
            className="p-1.5 rounded border bg-white hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear All Phrases"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {/* Scrollable list area inside panel */}
      <div className="flex-1 min-h-0">
        {tab==='pos' && (
          <div className="h-full min-h-0 overflow-auto rounded-xl">
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
          />
          </div>
        )}
        {tab==='neg' && (
          <div className="h-full min-h-0 overflow-auto rounded-xl">
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
          />
          </div>
        )}
        {tab==='key' && (
          <div className="h-full min-h-0 overflow-auto rounded-xl">
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
          </div>
        )}
      </div>
    </div>
  );
}


