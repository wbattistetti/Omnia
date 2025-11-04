import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useIntentStore } from './state/intentStore';
import { CenterPane } from './ui/CenterPane';
import { TestGrid } from './ui/RightTest';
import { actionRunAllTests } from './actions/runAllTests';
import { actionRunVisibleTests } from './actions/runVisibleTests';
import { getModelStatus, trainIntent, TrainingPhrase } from './services/trainingService';
import { Brain, Loader2, Sparkles, AlertTriangle, Trash2, CheckCircle, XCircle, Tag } from 'lucide-react';
import { ImportDropdown } from './ui/common/ImportDropdown';
import { generateVariantsForIntent } from './services/variantsService';
import { instanceRepository } from '../../services/InstanceRepository';

interface EmbeddingEditorShellProps {
  inlineMode?: boolean;
  intentSelected?: string; // Intent ID selected from IntentListEditor (when used in ResponseEditor)
  instanceId?: string; // Instance ID for syncing with instanceRepository (for badge updates)
}

// Componente per payoff temporaneo sotto Generate
function GeneratePayoff({ lastGen }: { lastGen: { count: number; requested: number } }) {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    // Scompare dopo 3 secondi
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [lastGen.count, lastGen.requested]);

  if (!visible) return null;

  return (
    <span
      className={[
        'absolute top-full left-0 mt-1 text-xs px-1 whitespace-nowrap',
        lastGen.count === 0 ? 'text-rose-700' :
        lastGen.count < lastGen.requested ? 'text-amber-700' :
        'text-emerald-700'
      ].join(' ')}
    >
      {lastGen.count < lastGen.requested
        ? `generated ${lastGen.count} phrases`
        : `${lastGen.count} phrases generated`}
    </span>
  );
}

export default function EmbeddingEditorShell({ inlineMode = false, intentSelected, instanceId }: EmbeddingEditorShellProps){
  // If intentSelected is provided (from ResponseEditor), use it; otherwise use useIntentStore
  const storeSelectedId = useIntentStore(s=>s.selectedId);
  const selectedId = intentSelected || storeSelectedId;

  // Get intents from store - ensure we always get an array
  const storeIntents = useIntentStore(s=>s.intents);
  // Memoize the intents array to ensure stable reference
  const intents = useMemo(() => {
    return (storeIntents && Array.isArray(storeIntents)) ? storeIntents : [];
  }, [storeIntents]);

  const selected = useMemo(() => {
    return intents.find(i=>i.id===selectedId);
  }, [intents, selectedId]);

  const posCount = selected?.variants?.curated?.length ?? 0;

  // Note: When intentSelected is provided (from ResponseEditor), intents are managed by IntentListEditor
  // which syncs with instanceRepository. The EmbeddingEditorShell reads from useIntentStore which
  // should be synced by HostAdapter when the editor is opened.
  const [testing, setTesting] = React.useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [testMode, setTestMode] = useState<'training' | 'new'>('new');
  const [training, setTraining] = useState(false);
  const [trainingTab, setTrainingTab] = useState<'pos'|'neg'|'key'>('pos');
  const [genN, setGenN] = useState<number>(10);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<{ count: number; requested: number } | null>(null);

  // ✅ Stato per generazione batch per tutti gli intenti
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; intentName: string } | null>(null);

  // ✅ Calcola hasTrainingData
  const hasTrainingData = selected && (
    (selected.variants.curated?.length || 0) > 0 ||
    (selected.variants.hardNeg?.length || 0) > 0
  );

  // ✅ Handler per il train (training del modello)
  const handleTrain = async () => {
    if (!selectedId || !selected) return;
    const positive = selected.variants.curated || [];
    const negative = selected.variants.hardNeg || [];

    if (positive.length === 0 && negative.length === 0) {
      alert('Aggiungi almeno una frase matching o not-matching per fare training');
      return;
    }

    try {
      setTraining(true);
      const phrases: TrainingPhrase[] = [
        ...positive.map(p => ({ id: p.id, text: p.text, type: 'matching' as const })),
        ...negative.map(p => ({ id: p.id, text: p.text, type: 'not-matching' as const }))
      ];

      const result = await trainIntent({ intentId: selectedId, phrases });
      setModelReady(result.modelReady);
      // Alert rimosso: training completato silenziosamente
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Training failed';
      console.error('[EmbeddingEditorShell] Training error:', err);
      // Alert rimosso: errori solo in console
    } finally {
      setTraining(false);
    }
  };

  // ✅ Handler per generare frasi per TUTTI gli intenti in batch con bilanciamento intelligente
  const handleBatchGenerate = async () => {
    // Usa intents direttamente dallo store per essere sicuri di avere l'ultima versione
    const currentIntents = useIntentStore.getState().intents || [];

    console.log('[EmbeddingEditorShell][BATCH_GENERATE][START]', {
      intentsCount: currentIntents.length,
      intents: currentIntents.map(i => ({ id: i.id, name: i.name })),
      genN,
      trainingTab,
      kind: trainingTab === 'pos' ? 'positive' : trainingTab === 'neg' ? 'negative' : 'keywords',
      instanceId: instanceId || 'NOT_PROVIDED'
    });

    if (currentIntents.length === 0) {
      console.warn('[EmbeddingEditorShell] No intents available for generation');
      return;
    }

    try {
      // ✅ Imposta progress PRIMA di batchGenerating per mostrare subito la progress bar
      setBatchProgress({ current: 0, total: currentIntents.length, intentName: 'Inizio generazione...' });
      setBatchGenerating(true);
      setGenError(null);

      // ✅ Forza un re-render immediato per mostrare la progress bar
      await new Promise(resolve => setTimeout(resolve, 100));

      const projectLang = (localStorage.getItem('project.lang') as any) || 'pt';
      const kind = trainingTab === 'pos' ? 'positive' : trainingTab === 'neg' ? 'negative' : 'keywords';
      const store = useIntentStore.getState();

      // ✅ CALCOLA BILANCIAMENTO: trova il max di frasi esistenti per tipo
      let maxExistingPhrases = 0;
      for (const intent of currentIntents) {
        let count = 0;
        if (trainingTab === 'pos') {
          count = (intent.variants?.curated || []).length;
        } else if (trainingTab === 'neg') {
          count = (intent.variants?.hardNeg || []).length;
        } else if (trainingTab === 'key') {
          count = ((intent as any).signals?.keywords || []).length;
        }
        if (count > maxExistingPhrases) {
          maxExistingPhrases = count;
        }
      }

      // ✅ Calcola quante frasi generare per intento vuoto (bilanciamento)
      const phrasesForEmpty = maxExistingPhrases > 0 ? maxExistingPhrases + genN : genN;

      console.log('[EmbeddingEditorShell][BATCH_GENERATE][BALANCING]', {
        maxExistingPhrases,
        genN,
        phrasesForEmpty,
        trainingTab,
        emptyIntentsCount: currentIntents.filter(intent => {
          if (trainingTab === 'pos') return (intent.variants?.curated || []).length === 0;
          if (trainingTab === 'neg') return (intent.variants?.hardNeg || []).length === 0;
          if (trainingTab === 'key') return ((intent as any).signals?.keywords || []).length === 0;
          return false;
        }).length
      });

      let totalGenerated = 0;
      let totalErrors = 0;

      for (let i = 0; i < currentIntents.length; i++) {
        const intent = currentIntents[i];
        console.log(`[EmbeddingEditorShell][BATCH_GENERATE][INTENT ${i + 1}/${currentIntents.length}]`, {
          intentId: intent.id,
          intentName: intent.name,
          kind
        });

        setBatchProgress({ current: i + 1, total: currentIntents.length, intentName: intent.name });

        // Forza un re-render per mostrare la progress bar
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
          const positive = intent.variants.curated || [];
          const negative = intent.variants.hardNeg || [];
          const keywords = (intent as any).signals?.keywords || [];

          let currentCount = 0;
          if (trainingTab === 'pos') {
            currentCount = positive.length;
          } else if (trainingTab === 'neg') {
            currentCount = negative.length;
          } else if (trainingTab === 'key') {
            currentCount = keywords.length;
          }

          // ✅ Genera più frasi per intenti vuoti per bilanciare
          const phrasesToGenerate = currentCount === 0 ? phrasesForEmpty : genN;

          console.log(`[EmbeddingEditorShell][BATCH_GENERATE][INTENT ${i + 1}][BALANCING]`, {
            intentName: intent.name,
            currentCount,
            phrasesToGenerate,
            isEmpty: currentCount === 0
          });

          const allExisting = [
            ...positive.map(p => p.text),
            ...negative.map(p => p.text),
            ...keywords.map((k: any) => k.t || k)
          ];

          const generated = await generateVariantsForIntent({
            intentName: intent.name,
            kind: kind as any,
            exclude: allExisting,
            n: phrasesToGenerate,
            lang: projectLang
          });

          // Aggiungi le frasi generate allo store
          for (const g of generated) {
            if (trainingTab === 'pos') {
              store.addCurated(intent.id, g, projectLang);
              totalGenerated++;
            } else if (trainingTab === 'neg') {
              store.addHardNeg(intent.id, {
                id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2),
                text: g,
                lang: projectLang
              });
              totalGenerated++;
            } else if (trainingTab === 'key') {
              store.addKeyword(intent.id, g, 1);
              totalGenerated++;
            }
          }

          // ✅ SINCRONIZZA IMMEDIATAMENTE con instanceRepository per aggiornare il badge
          // Rileggi dallo store per avere i dati aggiornati dopo l'aggiunta delle frasi
          if (instanceId) {
            try {
              const instance = instanceRepository.getInstance(instanceId);
              if (instance) {
                // Rileggi gli intenti dallo store per avere i dati aggiornati
                const updatedStoreIntents = useIntentStore.getState().intents || [];

                // Aggiorna l'intent specifico in instanceRepository
                const updatedIntents = (instance.problemIntents || []).map(pi => {
                  if (pi.id === intent.id || pi.name === intent.name) {
                    // Converti da useIntentStore format a ProblemIntent format
                    const storeIntent = updatedStoreIntents.find(i => i.id === intent.id);
                    if (storeIntent) {
                      return {
                        ...pi,
                        phrases: {
                          matching: (storeIntent.variants?.curated || []).map(v => ({ id: v.id, text: v.text, lang: v.lang })),
                          notMatching: (storeIntent.variants?.hardNeg || []).map(v => ({ id: v.id, text: v.text, lang: v.lang })),
                          keywords: (storeIntent.signals?.keywords || []),
                        }
                      };
                    }
                  }
                  return pi;
                });
                instanceRepository.updateIntents(instanceId, updatedIntents);

                const matchingCount = (updatedStoreIntents.find(i => i.id === intent.id)?.variants?.curated || []).length;
                console.log(`[EmbeddingEditorShell][BATCH_GENERATE][SYNC_BADGE][INTENT ${i + 1}]`, {
                  intentName: intent.name,
                  matchingCount,
                  instanceId
                });
              }
            } catch (err) {
              console.warn(`[EmbeddingEditorShell] Could not sync badge for intent ${intent.name}:`, err);
            }
          }

          console.log(`[EmbeddingEditorShell][BATCH_GENERATE][INTENT ${i + 1} COMPLETED]`, {
            intentName: intent.name,
            generatedCount: generated.length,
            requestedCount: phrasesToGenerate,
            totalGeneratedSoFar: totalGenerated
          });

          // Piccola pausa per evitare rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`[EmbeddingEditorShell] Error generating for intent ${intent.name}:`, err);
          totalErrors++;
        }
      }

      // Log completion without alert
      console.log('[EmbeddingEditorShell][BATCH_GENERATE][COMPLETE]', {
        totalGenerated,
        totalErrors,
        intentsCount: currentIntents.length
      });

      setBatchProgress(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione batch';
      setGenError(errorMsg);
      console.error('[EmbeddingEditorShell] Batch generation error:', err);
      // Non mostrare alert, solo log
    } finally {
      setBatchGenerating(false);
      setBatchProgress(null);
    }
  };

  // ✅ Handler per import frasi
  const handleImportPhrases = (values: string[]) => {
    if (!selectedId || !selected) return;
    const store = useIntentStore.getState();
    let added = 0;
    let duplicates = 0;

    const norm = (s: string) => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    const existsIn = (text: string, list: { text: string }[]) => list.find(p => norm(p.text) === norm(text));

    const positive = selected.variants.curated || [];
    const negative = selected.variants.hardNeg || [];
    const keywords = (selected as any).signals?.keywords || [];

    for (const value of values) {
      if (trainingTab === 'pos') {
        if (!existsIn(value, positive) && !existsIn(value, negative)) {
          store.addCurated(selectedId, value, 'it');
          added++;
        } else {
          duplicates++;
        }
      } else if (trainingTab === 'neg') {
        if (!existsIn(value, negative) && !existsIn(value, positive)) {
          store.addHardNeg(selectedId, {
            id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2),
            text: value,
            lang: 'it'
          });
          added++;
        } else {
          duplicates++;
        }
      } else if (trainingTab === 'key') {
        const keyTexts = keywords.map((k: any) => ({ text: k.t || k }));
        if (!existsIn(value, keyTexts)) {
          store.addKeyword(selectedId, value, 1);
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

  // ✅ Handler per generate
  const handleGenerate = async () => {
    if (!selectedId || !selected) return;

    try {
      setGenerating(true);
      setGenError(null);
      setLastGen(null);

      const positive = selected.variants.curated || [];
      const negative = selected.variants.hardNeg || [];
      const keywords = (selected as any).signals?.keywords || [];

      const allExisting = [
        ...positive.map(p => p.text),
        ...negative.map(p => p.text),
        ...keywords.map((k: any) => k.t || k)
      ];

      const kind = trainingTab === 'pos' ? 'positive' : trainingTab === 'neg' ? 'negative' : 'keywords';
      const projectLang = (localStorage.getItem('project.lang') as any) || 'pt';

      console.log('[EmbeddingEditor][GENERATE][START]', {
        intentName: selected.name,
        kind,
        n: genN,
        projectLang,
        projectLangSource: localStorage.getItem('project.lang') || 'NOT_FOUND',
        trainingTab,
        existingCount: allExisting.length
      });

      const generated = await generateVariantsForIntent({
        intentName: selected.name,
        kind: kind as any,
        exclude: allExisting,
        n: genN,
        lang: projectLang
      });

      console.log('[EmbeddingEditor][GENERATE][RESULT]', {
        intentName: selected.name,
        generatedCount: generated.length,
        generated: generated.slice(0, 5).map(g => g.substring(0, 50))
      });

      const store = useIntentStore.getState();
      let added = 0;
      const addedPhrases: string[] = [];

      for (const g of generated) {
        if (trainingTab === 'pos') {
          store.addCurated(selectedId, g, projectLang);
          addedPhrases.push(g);
          added++;
        } else if (trainingTab === 'neg') {
          store.addHardNeg(selectedId, {
            id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2),
            text: g,
            lang: projectLang
          });
          addedPhrases.push(g);
          added++;
        } else if (trainingTab === 'key') {
          store.addKeyword(selectedId, g, 1);
          addedPhrases.push(g);
          added++;
        }
      }

      console.log('[EmbeddingEditor][GENERATE][ADDED_TO_STORE]', {
        intentId: selectedId,
        intentName: selected.name,
        added,
        requested: genN,
        lang: projectLang,
        phrases: addedPhrases.slice(0, 5).map(p => p.substring(0, 50)),
        note: 'Store updated - will trigger debounced save in HostAdapter after 700ms'
      });

      setLastGen({ count: added, requested: genN });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione';
      setGenError(errorMsg);
      console.error('[EmbeddingEditorShell] Generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  // ✅ Handler per clear
  const handleClearTraining = () => {
    if (!selectedId) return;
    const store = useIntentStore.getState();
    if (trainingTab === 'pos') {
      store.clearCurated(selectedId);
    } else if (trainingTab === 'neg') {
      store.clearHardNeg(selectedId);
    } else if (trainingTab === 'key') {
      store.clearKeywords(selectedId);
    }
  };

  // ✅ Calcola count per tab corrente
  const currentTabCount = trainingTab === 'pos'
    ? (selected?.variants.curated.length || 0)
    : trainingTab === 'neg'
    ? (selected?.variants.hardNeg.length || 0)
    : ((selected as any)?.signals?.keywords?.length || 0);

  // ✅ Stato per la larghezza del pannello destro (test)
  const [rightPanelWidth, setRightPanelWidth] = useState(360);

  // ✅ Ref e stato per mantenere larghezze fisse durante il drag
  const containerRef = useRef<HTMLDivElement>(null);
  const [fixedRightWidth, setFixedRightWidth] = useState<number | null>(null);

  // ✅ Verifica stato modello quando cambia selectedId
  useEffect(() => {
    if (!selectedId) {
      setModelReady(false);
      return;
    }
    getModelStatus(selectedId).then(status => {
      setModelReady(status.modelReady);
    }).catch(() => {
      setModelReady(false);
    });
  }, [selectedId]);

  React.useEffect(() => {
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[EmbeddingEditorShell][mount]', { selectedId, intentSelected }); } catch {}
    return () => { try { if (localStorage.getItem('debug.intent') === '1') console.log('[EmbeddingEditorShell][unmount]'); } catch {} };
  }, [selectedId, intentSelected]);

  // ✅ Handler per il drag dello slider tra Training phrases e Test
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const dragStartRightRef = React.useRef<{ x: number; width: number } | null>(null);
  const lastRightWidthRef = React.useRef<number>(rightPanelWidth);

  const handleMouseDownRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);

    dragStartRightRef.current = {
      x: e.clientX,
      width: rightPanelWidth
    };
    lastRightWidthRef.current = rightPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  React.useEffect(() => {
    lastRightWidthRef.current = rightPanelWidth;
  }, [rightPanelWidth]);

  React.useEffect(() => {
    if (!isDraggingRight) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRightRef.current) return;
      const delta = e.clientX - dragStartRightRef.current.x;
      // Il delta negativo quando trasciniamo a sinistra (riduce la larghezza)
      const newWidth = Math.max(280, Math.min(800, dragStartRightRef.current.width - delta));
      setRightPanelWidth(newWidth);
      lastRightWidthRef.current = newWidth;
    };

    const handleMouseUp = () => {
      setIsDraggingRight(false);
      dragStartRightRef.current = null;
      // ✅ Rimuovi la larghezza fissa quando finisce il drag
      setFixedRightWidth(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalWidth = lastRightWidthRef.current;
      if (finalWidth >= 280 && finalWidth <= 800) {
        localStorage.setItem('intent-editor-right-panel-width', finalWidth.toString());
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingRight]);

  // ✅ Carica larghezza destra salvata al mount
  React.useEffect(() => {
    const savedRight = localStorage.getItem('intent-editor-right-panel-width');
    if (savedRight) {
      const savedWidth = parseInt(savedRight);
      if (savedWidth >= 280 && savedWidth <= 800) {
        setRightPanelWidth(savedWidth);
      }
    }
  }, []);

  // Show message if no intent selected (always render same structure to avoid hooks order issues)
  return (
    <div ref={containerRef} className="flex gap-0 p-4 h-full flex-1 min-w-0 overflow-hidden" style={{ maxWidth: '100%' }}>
      {/* ✅ Toolbar verticale sempre visibile: Train button + Must Match / Can't Match / Keywords */}
      <div className="flex flex-col gap-2 border-r border-amber-100 bg-amber-50/50 p-2" style={{ width: 60 }}>
        {/* Train button sempre visibile - genera per tutti gli intenti */}
        <button
          onClick={handleBatchGenerate}
          disabled={batchGenerating || intents.length === 0}
          className={`px-2 py-2 rounded-md border flex flex-col items-center gap-1 ${
            batchGenerating ? 'bg-blue-100' :
            modelReady ? 'bg-green-100 border-green-300' :
            intents.length === 0 ? 'opacity-50' :
            'bg-white hover:bg-blue-50'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
          title={batchGenerating ? 'Generazione in corso...' : modelReady ? 'Model ready - Click to regenerate' : `Generate ${genN} phrases for all ${intents.length} intents`}
          style={{ minHeight: 80 }}
        >
          {batchGenerating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Brain size={18} className={modelReady ? 'text-green-600' : ''} />
          )}
          <span className="text-xs font-semibold" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            {batchGenerating ? 'Generating...' : 'Train'}
          </span>
        </button>

        {/* Vertical strip: Must Match, Can't Match, Keywords (testo verticale) - sempre visibile */}
        <div className="flex flex-col gap-2">
          <button
            className={`p-2 rounded border flex flex-col items-center justify-center gap-1 ${
              trainingTab === 'pos'
                ? 'bg-emerald-100 border-emerald-300'
                : 'bg-white hover:bg-gray-50'
            }`}
            onClick={() => setTrainingTab('pos')}
            title="Must Match"
            style={{ minHeight: 70 }}
          >
            <CheckCircle size={18} className={trainingTab === 'pos' ? 'text-emerald-600' : 'text-gray-600'} />
            <span
              className={`text-xs font-semibold ${trainingTab === 'pos' ? 'text-emerald-700' : 'text-gray-600'}`}
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '0.1em'
              }}
            >
              Must Match
            </span>
          </button>
          <button
            className={`p-2 rounded border flex flex-col items-center justify-center gap-1 ${
              trainingTab === 'neg'
                ? 'bg-rose-100 border-rose-300'
                : 'bg-white hover:bg-gray-50'
            }`}
            onClick={() => setTrainingTab('neg')}
            title="Can't Match"
            style={{ minHeight: 70 }}
          >
            <XCircle size={18} className={trainingTab === 'neg' ? 'text-rose-600' : 'text-gray-600'} />
            <span
              className={`text-xs font-semibold ${trainingTab === 'neg' ? 'text-rose-700' : 'text-gray-600'}`}
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '0.1em'
              }}
            >
              Can't Match
            </span>
          </button>
          <button
            className={`p-2 rounded border flex flex-col items-center justify-center gap-1 ${
              trainingTab === 'key'
                ? 'bg-indigo-100 border-indigo-300'
                : 'bg-white hover:bg-gray-50'
            }`}
            onClick={() => setTrainingTab('key')}
            title="Keywords"
            style={{ minHeight: 70 }}
          >
            <Tag size={18} className={trainingTab === 'key' ? 'text-indigo-600' : 'text-gray-600'} />
            <span
              className={`text-xs font-semibold ${trainingTab === 'key' ? 'text-indigo-700' : 'text-gray-600'}`}
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '0.1em'
              }}
            >
              Keywords
            </span>
          </button>
        </div>

        {/* Input per numero frasi da generare - sempre visibile */}
        <div className="mt-2">
          <input
            type="number"
            min={1}
            max={50}
            value={genN}
            onChange={e => setGenN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-full px-2 py-1 rounded-md border text-center text-xs"
            title={`Numero di frasi da generare per intento (attualmente: ${genN})`}
            disabled={batchGenerating}
          />
          <div className="text-[10px] text-gray-500 text-center mt-1">per intento</div>
        </div>
      </div>

      {/* ✅ Area principale con progress bar e contenuto */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Progress bar quando batchGenerating è attivo - sempre in alto e visibile */}
        {batchGenerating && batchProgress && (
          <div className="bg-blue-50 border-b-2 border-blue-300 p-3 flex-shrink-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-blue-900 truncate mb-1">
                  Generando per: <strong className="text-blue-700">{batchProgress.intentName || 'Inizio...'}</strong> ({batchProgress.current}/{batchProgress.total})
                </div>
                <div className="mt-2 bg-blue-200 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="bg-blue-600 h-full transition-all duration-500 ease-out flex items-center justify-end pr-2"
                    style={{ width: `${Math.min(100, Math.max(0, (batchProgress.current / batchProgress.total) * 100))}%` }}
                  >
                    <span className="text-[10px] text-white font-semibold">
                      {Math.round((batchProgress.current / batchProgress.total) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  {batchProgress.current} di {batchProgress.total} intenti processati
                </div>
              </div>
            </div>
          </div>
        )}

        {!selectedId || !selected ? (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Seleziona un intento</p>
              <p className="text-sm">Seleziona un intento dalla lista a sinistra per vedere le frasi di training</p>
            </div>
          </div>
        ) : (
          <>
            {/* Container per Training phrases + Test */}
            <div className="flex gap-0 min-w-0 overflow-hidden flex-1">
              {/* Training phrases panel - occupa lo spazio rimanente */}
              <div className="flex-1 bg-white border rounded-2xl shadow-sm flex flex-col min-h-0 min-w-0 overflow-hidden">
                <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-amber-800">Training set: {selected.name}</h2>

                    {/* Generate per intento singolo, numero, Import */}
                    <div className="flex items-center gap-2 ml-3">
                      <div className="relative flex items-center">
                        <button
                          className={`px-2 py-1 rounded-md border flex items-center gap-1 ${genError ? 'text-red-600 border-red-300' : ''}`}
                          title={genError ? genError : (generating ? 'Generating…' : 'Genera suggerimenti per questo intento')}
                          disabled={generating || batchGenerating}
                          onClick={handleGenerate}
                        >
                          {generating ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Generate
                            </span>
                          ) : genError ? (
                            <span className="flex items-center gap-1">
                              <AlertTriangle size={14} className="text-red-600" /> Generate
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Sparkles size={14} /> Generate
                            </span>
                          )}
                        </button>
                        {/* Payoff temporaneo: appare sotto Generate e scompare dopo pochi secondi */}
                        {!generating && lastGen && (
                          <GeneratePayoff lastGen={lastGen} />
                        )}
                      </div>
                      <ImportDropdown
                        onImport={handleImportPhrases}
                        buttonLabel="Import"
                        successMessage={(count) => `Importate ${count} frasi`}
                        errorMessage={{
                          clipboard: 'Errore durante la lettura del clipboard',
                          file: 'Errore durante la lettura del file',
                          empty: 'Nessuna frase valida trovata'
                        }}
                      />
                    </div>
                  </div>

                  {/* Right side: Train model e Test (separati/staccati) */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleTrain}
                      disabled={training || !hasTrainingData || batchGenerating}
                      className={`px-3 py-1.5 rounded-md border flex items-center gap-1 ${
                        training ? 'bg-blue-100' :
                        modelReady ? 'bg-green-100 border-green-300' :
                        !hasTrainingData ? 'opacity-50' :
                        'bg-white hover:bg-blue-50'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                      title={training ? 'Training in corso...' : modelReady ? 'Model ready - Click to retrain' : 'Train embeddings model'}
                    >
                      {training ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Brain size={14} className={modelReady ? 'text-green-600' : ''} />
                      )}
                      {modelReady ? 'Retrain' : 'Train Model'}
                    </button>

                    <button
                      className="px-3 py-1.5 rounded-lg border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1"
                      onClick={async () => {
                        try {
                          setTesting(true);
                          try { if (localStorage.getItem('debug.intent') === '1') console.log('[UI][RunTest][click]'); } catch {}
                          // Testa le frasi del training set (positive + negative) del selected intent
                          if (selected && selectedId) {
                            const trainingItems = [
                              ...(selected.variants.curated || []).map(p => ({ id: p.id, text: p.text })),
                              ...(selected.variants.hardNeg || []).map(p => ({ id: p.id, text: p.text }))
                            ];
                            if (trainingItems.length > 0) {
                              await actionRunVisibleTests(trainingItems);
                            } else {
                              // Fallback: testa frasi nel TestGrid se ci sono
                              const visibleItems = (window as any).__testGridVisibleItems || [];
                              if (visibleItems.length > 0) {
                                await actionRunVisibleTests(visibleItems);
                              } else {
                                await actionRunAllTests();
                              }
                            }
                          } else {
                            // Fallback: testa tutte le frasi in testStore
                            await actionRunAllTests();
                          }
                        } finally { setTesting(false); }
                      }}
                      title="Run test on training phrases"
                      disabled={testing || !modelReady || batchGenerating}
                    >
                      {testing ? (
                        <span className="flex items-center gap-1">
                          <Loader2 size={14} className="animate-spin" />
                          Testing…
                        </span>
                      ) : (
                        'Test'
                      )}
                    </button>
                  </div>
                </div>

                {/* Content area con griglia frasi */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  {/* Griglia frasi centrale */}
                  <div className="p-3 flex-1 min-h-0 overflow-auto">
                    <CenterPane intentId={selectedId} tab={trainingTab} setTab={setTrainingTab} />
                  </div>
                </div>
              </div>

              {/* ✅ Resize Handle tra Training phrases e Test */}
              <div
                onMouseDown={handleMouseDownRight}
                className="flex-shrink-0 flex items-center justify-center cursor-col-resize hover:bg-blue-100/30 transition-colors group"
                style={{ width: 8 }}
                role="separator"
                aria-label="Drag to resize panels"
              >
                <div className="w-0.5 h-12 bg-slate-300 rounded-full group-hover:bg-blue-500 transition-colors" />
              </div>

              {/* Test panel - nascosto quando inlineMode */}
              {!inlineMode && (
                <div
                  className="bg-white border rounded-2xl shadow-sm flex flex-col min-h-0 flex-shrink-0 overflow-hidden"
                  style={{ width: rightPanelWidth, minWidth: 280, maxWidth: 800 }}
                >
                  <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl flex items-center justify-between gap-2">
                    {/* Left side: Title + phrases buttons */}
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-amber-800">Test phrases</h2>
                      <div className="flex items-center gap-1 border rounded-lg p-1">
                        <button
                          onClick={() => setTestMode('training')}
                          disabled={!selectedId || !hasTrainingData}
                          className={`px-2 py-1 rounded border ${
                            testMode === 'training'
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-white hover:bg-gray-50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title="Mostra frasi di training"
                        >
                          Training
                        </button>
                        <button
                          onClick={() => setTestMode('new')}
                          className={`px-2 py-1 rounded border ${
                            testMode === 'new'
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-white hover:bg-gray-50'
                          }`}
                          title="Mostra frasi nuove"
                        >
                          New
                        </button>
                      </div>
                    </div>

                    {/* Right side: Train/Retrain + Run test */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTrain}
                        disabled={training || !hasTrainingData || batchGenerating}
                        className={`px-3 py-1 rounded-md border flex items-center gap-1 ${
                          training ? 'bg-blue-100' :
                          modelReady ? 'bg-green-100 border-green-300' :
                          !hasTrainingData ? 'opacity-50' :
                          'bg-white hover:bg-blue-50'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                        title={training ? 'Training in corso...' : modelReady ? 'Model ready - Click to retrain' : 'Train embeddings model'}
                      >
                        {training ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Brain size={14} className={modelReady ? 'text-green-600' : ''} />
                        )}
                        {modelReady ? 'Retrain' : 'Train'}
                      </button>

                      {modelReady && (
                        <button
                          className="px-3 py-1 rounded-lg border bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          onClick={async () => {
                            try {
                              setTesting(true);
                              try { if (localStorage.getItem('debug.intent') === '1') console.log('[UI][RunTest][click]'); } catch {}
                              // ✅ Testa le frasi visibili nel TestGrid (training set o new phrases)
                              const visibleItems = (window as any).__testGridVisibleItems || [];
                              if (visibleItems.length > 0) {
                                await actionRunVisibleTests(visibleItems);
                              } else {
                                // Fallback: testa tutte le frasi in testStore
                                await actionRunAllTests();
                              }
                            } finally { setTesting(false); }
                          }}
                          title="Run test on visible phrases"
                          disabled={testing || !modelReady || batchGenerating}
                        >
                          {testing ? 'Testing…' : 'Run test'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-3 min-h-0 flex-1">
                    <TestGrid intentId={selectedId} modelReady={modelReady} mode={testMode} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

