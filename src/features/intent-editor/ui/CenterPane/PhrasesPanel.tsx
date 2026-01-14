import React, { useEffect, useMemo, useState } from 'react';
import ListGrid from '../common/ListGrid';
import { useIntentStore } from '../../state/intentStore';
import { usePhraseClassification } from '../../hooks/usePhraseClassification';
import PhraseRow from './PhraseRow';

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

  // ✅ ENTERPRISE: Classification hook for training phrases
  const allTrainingPhrases = useMemo(() => [
    ...positive.map(p => ({ id: p.id, text: p.text, type: 'matching' as const })),
    ...negative.map(p => ({ id: p.id, text: p.text, type: 'not-matching' as const }))
  ], [positive, negative]);

  const { results: classificationResults, modelReady } = usePhraseClassification(
    intentId,
    allTrainingPhrases,
    true // enabled
  );

  // ✅ ENTERPRISE: Handler to add phrase as not-matching for wrong intent
  const handleAddAsNotMatching = (wrongIntentId: string, phraseText: string) => {
    try {
      const wrongIntent = useIntentStore.getState().intents.find(i => i.id === wrongIntentId);
      if (!wrongIntent) {
        console.error('[PhrasesPanel] Intent not found:', wrongIntentId);
        return;
      }

      // Add phrase as not-matching for the wrong intent
      const variant = {
        id: crypto.randomUUID(),
        text: phraseText,
        lang: lang as any
      };
      useIntentStore.getState().addHardNeg(wrongIntentId, variant);

      console.log('[PhrasesPanel] Added phrase as not-matching', {
        phraseText,
        wrongIntentId,
        wrongIntentName: wrongIntent.name
      });
    } catch (err) {
      console.error('[PhrasesPanel] Failed to add as not-matching:', err);
    }
  };

  // ✅ ENTERPRISE: Handler to toggle phrase exclusion status
  const handleToggleExclusion = (phraseId: string, phraseText: string, currentIsExcluded: boolean) => {
    try {
      if (currentIsExcluded) {
        // Rimuovere da not-matching e aggiungere a matching
        // Trova tutti gli intenti dove la frase è stata esclusa
        const allIntents = useIntentStore.getState().intents;
        for (const intent of allIntents) {
          const hardNegPhrase = intent.variants?.hardNeg?.find(n => n.text === phraseText);
          if (hardNegPhrase) {
            useIntentStore.getState().removeHardNeg(intent.id, hardNegPhrase.id);
            console.log('[PhrasesPanel] Removed phrase from not-matching', {
              phraseText,
              intentId: intent.id,
              intentName: intent.name
            });
          }
        }
        // Aggiungere come matching all'intento corrente se non esiste già
        const currentPhrase = positive.find(p => p.text === phraseText);
        if (!currentPhrase) {
          useIntentStore.getState().addCurated(intentId, phraseText, lang);
          console.log('[PhrasesPanel] Added phrase as matching', {
            phraseText,
            intentId,
            intentName
          });
        }
      } else {
        // Escludere la frase: aggiungere come not-matching
        const classificationResult = classificationResults.get(phraseId);

        // Determina l'intento target per l'esclusione
        let targetIntentId: string | undefined;
        if (classificationResult?.intentId && !classificationResult.isCorrect) {
          // Se la classificazione è sbagliata, escludi dall'intento sbagliato
          targetIntentId = classificationResult.intentId;
        } else {
          // Altrimenti, escludi dall'intento corrente (prevenzione)
          targetIntentId = intentId;
        }

        if (targetIntentId) {
          const targetIntent = useIntentStore.getState().intents.find(i => i.id === targetIntentId);
          if (targetIntent) {
            // Verifica se non è già presente
            const alreadyExcluded = targetIntent.variants?.hardNeg?.some(n => n.text === phraseText);
            if (!alreadyExcluded) {
              useIntentStore.getState().addHardNeg(targetIntentId, {
                id: crypto.randomUUID(),
                text: phraseText,
                lang: lang as any
              });
              console.log('[PhrasesPanel] Added phrase as not-matching via toggle', {
                phraseText,
                targetIntentId,
                targetIntentName: targetIntent.name,
                reason: classificationResult?.intentId && !classificationResult.isCorrect
                  ? 'wrong_classification'
                  : 'preventive_exclusion'
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[PhrasesPanel] Failed to toggle exclusion:', err);
    }
  };

  // ✅ Funzione per className delle righe (solo selected, niente colorazione)
  const getRowClassName = (item: { id: string; label: string }, selected: boolean): string => {
    return selected ? 'bg-amber-50' : 'hover:bg-gray-50';
  };

  // ✅ ENTERPRISE: Smart label renderer using PhraseRow component
  const renderPhraseRow = (item: { id: string; label: string }, phraseType: 'matching' | 'not-matching') => {
    const phrase = phraseType === 'matching'
      ? positive.find(p => p.id === item.id)
      : negative.find(p => p.id === item.id);

    if (!phrase) {
      return item.label; // Fallback
    }

    const classificationResult = classificationResults.get(item.id);
    const testResult = testResults.get(item.id);

    // ✅ Check if phrase is excluded (added as not-matching to any intent)
    const isExcluded = (() => {
      // Check if phrase is in hardNeg list of current intent
      const currentIntent = useIntentStore.getState().intents.find(i => i.id === intentId);
      if (currentIntent?.variants?.hardNeg?.some(n => n.text === phrase.text)) {
        return true;
      }
      // Check if phrase is in hardNeg list of wrong intent (if classification is wrong)
      if (classificationResult?.intentId && !classificationResult.isCorrect) {
        const wrongIntent = useIntentStore.getState().intents.find(i => i.id === classificationResult.intentId);
        return wrongIntent?.variants?.hardNeg?.some(n => n.text === phrase.text) ?? false;
      }
      return false;
    })();

    return (
      <PhraseRow
        phrase={phrase}
        phraseType={phraseType}
        intentId={intentId}
        intentName={intentName}
        classificationResult={classificationResult}
        modelReady={modelReady}
        testResult={testResult}
        isExcluded={isExcluded}
        onAddAsNotMatching={(wrongIntentId) => {
          handleAddAsNotMatching(wrongIntentId, phrase.text);
        }}
        onToggleExclusion={handleToggleExclusion}
      />
    );
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


  // ✅ SOLUZIONE ESPERTO: Rimuovere h-full, usare solo flex-1 min-h-0
  return (
    <div className="mt-2 flex flex-col flex-1 min-h-0 overflow-hidden">
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
              const phrase = posItems.find(p => p.id === id);
              if (phrase) {
                useIntentStore.getState().removeCurated(intentId, id);
              }
            }}
            onEnterAdd={(text)=>{
              // dedup locale e cross-tab
              if (existsIn(text, posItems)) return; // TODO: scroll a item
              if (existsIn(text, negItems)) { setTab('neg'); return; }
              onAddPositive(text);
            }}
            sort="alpha"
            rowClassName={getRowClassName}
            labelRenderer={(item) => renderPhraseRow(item, 'matching')}
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
            sort="alpha"
            rowClassName={getRowClassName}
            labelRenderer={(item) => renderPhraseRow(item, 'not-matching')}
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
            onDeleteItem={(id)=>{
              const keyword = keyItems.find(k => k.id === id);
              if (keyword) {
                useIntentStore.getState().removeKeyword(intentId, keyword.term);
              }
            }}
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


