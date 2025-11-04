import React, { useEffect, useState, useRef } from 'react';
import ItemList from '../../components/common/ItemList';
import { useIntentStore } from './state/intentStore';
import { GitBranch } from 'lucide-react';
import { CenterPane } from './ui/CenterPane';
import { TestGrid } from './ui/RightTest';
import { actionRunAllTests } from './actions/runAllTests';
import { actionRunVisibleTests } from './actions/runVisibleTests';
import { getModelStatus, trainIntent, TrainingPhrase } from './services/trainingService';
import { Brain, Loader2, Sparkles, AlertTriangle, Trash2, CheckCircle, XCircle, Tag } from 'lucide-react';
import { ImportDropdown } from './ui/common/ImportDropdown';
import { generateVariantsForIntent } from './services/variantsService';

interface EmbeddingEditorShellProps {
  inlineMode?: boolean;
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

export default function EmbeddingEditorShell({ inlineMode = false }: EmbeddingEditorShellProps){
  const selectedId = useIntentStore(s=>s.selectedId);
  const selected = useIntentStore(s=> s.intents.find(i=>i.id===s.selectedId));
  const intents = useIntentStore(s=>s.intents);
  const posCount = selected?.variants.curated.length ?? 0;
  const [testing, setTesting] = React.useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [testMode, setTestMode] = useState<'training' | 'new'>('new');
  const [training, setTraining] = useState(false);
  const [trainingTab, setTrainingTab] = useState<'pos'|'neg'|'key'>('pos');
  const [genN, setGenN] = useState<number>(10);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastGen, setLastGen] = useState<{ count: number; requested: number } | null>(null);

  // ✅ Calcola hasTrainingData
  const hasTrainingData = selected && (
    (selected.variants.curated?.length || 0) > 0 ||
    (selected.variants.hardNeg?.length || 0) > 0
  );

  // ✅ Handler per il train
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

  // ✅ Stato per la larghezza dei pannelli
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);

  // ✅ Ref e stato per mantenere larghezze fisse durante il drag
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRightContainerRef = useRef<HTMLDivElement>(null);
  const [fixedCenterRightWidth, setFixedCenterRightWidth] = useState<number | null>(null);
  const [fixedLeftSectionWidth, setFixedLeftSectionWidth] = useState<number | null>(null);

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
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[EmbeddingEditorShell][mount]', { selectedId }); } catch {}
    return () => { try { if (localStorage.getItem('debug.intent') === '1') console.log('[EmbeddingEditorShell][unmount]'); } catch {} };
  }, [selectedId]);

  // ✅ Handler per il drag dello slider tra Intents e Training phrases
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const dragStartLeftRef = React.useRef<{ x: number; width: number } | null>(null);
  const lastLeftWidthRef = React.useRef<number>(leftPanelWidth);

  const handleMouseDownLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeft(true);

    // ✅ Salva la larghezza corrente del container "Center + Right" per mantenerla fissa
    if (centerRightContainerRef.current) {
      setFixedCenterRightWidth(centerRightContainerRef.current.offsetWidth);
    }

    dragStartLeftRef.current = {
      x: e.clientX,
      width: leftPanelWidth
    };
    lastLeftWidthRef.current = leftPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  React.useEffect(() => {
    lastLeftWidthRef.current = leftPanelWidth;
  }, [leftPanelWidth]);

  React.useEffect(() => {
    if (!isDraggingLeft) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartLeftRef.current) return;
      const delta = e.clientX - dragStartLeftRef.current.x;
      // Il delta positivo aumenta la larghezza del pannello sinistro
      const newWidth = Math.max(250, Math.min(600, dragStartLeftRef.current.width + delta));
      setLeftPanelWidth(newWidth);
      lastLeftWidthRef.current = newWidth;
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      dragStartLeftRef.current = null;
      // ✅ Rimuovi la larghezza fissa quando finisce il drag
      setFixedCenterRightWidth(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      const finalWidth = lastLeftWidthRef.current;
      if (finalWidth >= 250 && finalWidth <= 600) {
        localStorage.setItem('intent-editor-left-panel-width', finalWidth.toString());
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
  }, [isDraggingLeft]);

  // ✅ Handler per il drag dello slider tra Training phrases e Test
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const dragStartRightRef = React.useRef<{ x: number; width: number } | null>(null);
  const lastRightWidthRef = React.useRef<number>(rightPanelWidth);

  const handleMouseDownRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);

    // ✅ Salva la larghezza corrente della sezione sinistra (Intents + slider) per mantenerla fissa
    if (containerRef.current) {
      const leftSectionWidth = leftPanelWidth + 8; // Intents + slider
      setFixedLeftSectionWidth(leftSectionWidth);
    }

    // ✅ IMPORTANTE: Fissa anche la larghezza del container "Center + Right" per evitare che si espanda
    if (centerRightContainerRef.current) {
      setFixedCenterRightWidth(centerRightContainerRef.current.offsetWidth);
    }

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
      // ✅ Rimuovi entrambe le larghezze fisse quando finisce il drag
      setFixedLeftSectionWidth(null);
      setFixedCenterRightWidth(null);
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

  // ✅ Carica larghezze salvate al mount
  React.useEffect(() => {
    const savedLeft = localStorage.getItem('intent-editor-left-panel-width');
    if (savedLeft) {
      const savedWidth = parseInt(savedLeft);
      if (savedWidth >= 250 && savedWidth <= 600) {
        setLeftPanelWidth(savedWidth);
      }
    }
    const savedRight = localStorage.getItem('intent-editor-right-panel-width');
    if (savedRight) {
      const savedWidth = parseInt(savedRight);
      if (savedWidth >= 280 && savedWidth <= 800) {
        setRightPanelWidth(savedWidth);
      }
    }
  }, []);

  return (
    <div ref={containerRef} className="flex gap-0 p-4 h-full flex-1 min-w-0 overflow-hidden" style={{ maxWidth: '100%' }}>
      {/* Sezione sinistra: Intents + slider - larghezza fissa quando si trascina slider destro */}
      <div
        className="flex-shrink-0"
        style={{
          width: fixedLeftSectionWidth !== null ? fixedLeftSectionWidth : undefined,
          display: 'flex',
          gap: 0
        }}
      >
        {/* Intents panel - larghezza controllata - READ ONLY per EmbeddingEditor */}
        <div
          className="flex-shrink-0"
          style={{ width: leftPanelWidth, minWidth: 250, maxWidth: 600 }}
        >
          <ItemList
            items={intents.map(i => ({
              id: i.id,
              label: i.name,
              meta: {
                pos: i.variants.curated.length,
                neg: i.variants.hardNeg.length,
                key: (i.signals.keywords || []).length,
              }
            }))}
            selectedId={selectedId}
            onSelect={(id) => useIntentStore.getState().select(id)}
            LeftIcon={GitBranch}
            getBadge={(item) => item.meta?.pos ?? 0}
            sort="alpha"
          />
        </div>

        {/* ✅ Resize Handle tra Intents e Training phrases */}
        <div
          onMouseDown={handleMouseDownLeft}
          className="flex-shrink-0 flex items-center justify-center cursor-col-resize hover:bg-blue-100/30 transition-colors group"
          style={{ width: 8 }}
          role="separator"
          aria-label="Drag to resize panels"
        >
          <div className="w-0.5 h-12 bg-slate-300 rounded-full group-hover:bg-blue-500 transition-colors" />
        </div>
      </div>

      {/* Container per Center + Right con larghezza FISSA quando si trascina slider sinistro o destro */}
      <div
        ref={centerRightContainerRef}
        className="flex gap-0 min-w-0 overflow-hidden"
        style={{
          width: fixedCenterRightWidth !== null ? `${fixedCenterRightWidth}px` : undefined,
          maxWidth: fixedCenterRightWidth !== null ? `${fixedCenterRightWidth}px` : undefined,
          flex: fixedCenterRightWidth === null ? 1 : undefined,
          flexShrink: fixedCenterRightWidth !== null ? 0 : undefined
        }}
      >
        {/* Training phrases panel - occupa lo spazio rimanente */}
        <div className="flex-1 bg-white border rounded-2xl shadow-sm flex flex-col min-h-0 min-w-0 overflow-hidden">
          <div className="p-3 border-b border-amber-100 bg-amber-50 rounded-t-2xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-amber-800">Training set</h2>

              {/* Generate, numero, Import e payoff temporaneo */}
              <div className="flex items-center gap-2 ml-3">
                <div className="relative flex items-center">
                  <button
                    className={`px-2 py-1 rounded-md border flex items-center gap-1 ${genError ? 'text-red-600 border-red-300' : ''}`}
                    title={genError ? genError : (generating ? 'Generating…' : 'Genera suggerimenti')}
                    disabled={generating}
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
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={genN}
                  onChange={e => setGenN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="w-14 px-2 py-1 rounded-md border"
                  title="Numero di frasi da generare"
                />
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

            {/* Right side: Train e Test (separati/staccati) */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleTrain}
                disabled={training || !hasTrainingData}
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
                {modelReady ? 'Retrain' : 'Train'}
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
                disabled={testing || !modelReady}
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

          {/* Content area con strip verticale e griglia */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Vertical strip: Must Match, Can't Match, Keywords (testo verticale) */}
            <div className="flex flex-col gap-2 p-2 border-r border-amber-100 bg-amber-50/50" style={{ width: 50 }}>
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
                disabled={training || !hasTrainingData}
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
                  disabled={testing || !modelReady}
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
    </div>
  );
}

