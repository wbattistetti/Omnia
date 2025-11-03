import React, { useEffect, useState, useRef } from 'react';
import { LeftGrid } from './ui/LeftGrid';
import { CenterPane } from './ui/CenterPane';
import { TestGrid } from './ui/RightTest';
import { actionRunAllTests } from './actions/runAllTests';
import { actionRunVisibleTests } from './actions/runVisibleTests';
import { useIntentStore } from './state/intentStore';
import { getModelStatus, trainIntent, TrainingPhrase } from './services/trainingService';
import { Brain, Loader2, Sparkles, AlertTriangle, Trash2, CheckCircle, XCircle, Tag } from 'lucide-react';
import { ImportDropdown } from './ui/common/ImportDropdown';
import { generateVariantsForIntent } from './services/variantsService';

interface IntentEditorShellProps {
  inlineMode?: boolean;
}

export default function IntentEditorShell({ inlineMode = false }: IntentEditorShellProps){
  const selectedId = useIntentStore(s=>s.selectedId);
  const selected = useIntentStore(s=> s.intents.find(i=>i.id===s.selectedId));
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
      alert(`Model ready! Processed ${result.stats.total} phrases (${result.stats.matching} matching, ${result.stats.notMatching} not-matching)`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Training failed';
      console.error('[IntentEditorShell] Training error:', err);
      alert(`Training failed: ${errorMsg}`);
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
      const generated = await generateVariantsForIntent({
        intentName: selected.name,
        kind: kind as any,
        exclude: allExisting,
        n: genN,
        lang: (localStorage.getItem('project.lang') as any) || 'pt'
      });

      const store = useIntentStore.getState();
      let added = 0;
      for (const g of generated) {
        if (trainingTab === 'pos') {
          store.addCurated(selectedId, g, 'it');
          added++;
        } else if (trainingTab === 'neg') {
          store.addHardNeg(selectedId, {
            id: (crypto as any).randomUUID?.() || Math.random().toString(36).slice(2),
            text: g,
            lang: 'it'
          });
          added++;
        } else if (trainingTab === 'key') {
          store.addKeyword(selectedId, g, 1);
          added++;
        }
      }
      setLastGen({ count: added, requested: genN });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Errore durante la generazione';
      setGenError(errorMsg);
      console.error('[IntentEditorShell] Generation error:', err);
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
    try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentEditorShell][mount]', { selectedId }); } catch {}
    return () => { try { if (localStorage.getItem('debug.intent') === '1') console.log('[IntentEditorShell][unmount]'); } catch {} };
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
        {/* Intents panel - larghezza controllata */}
        <div
          className="flex-shrink-0"
          style={{ width: leftPanelWidth, minWidth: 250, maxWidth: 600 }}
        >
          <LeftGrid />
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

              {/* Tab buttons: Must Match, Can't Match, Keywords */}
              <div className="flex items-center gap-1 ml-3">
                <button
                  className={`px-3 py-1.5 flex items-center gap-2 rounded border ${
                    trainingTab === 'pos'
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setTrainingTab('pos')}
                >
                  <CheckCircle size={16} className="text-emerald-600" />
                  <span>Must Match</span>
                </button>
                <button
                  className={`px-3 py-1.5 flex items-center gap-2 rounded border ${
                    trainingTab === 'neg'
                      ? 'bg-rose-100 border-rose-300 text-rose-700'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setTrainingTab('neg')}
                >
                  <XCircle size={16} className="text-rose-600" />
                  <span>Can't Match</span>
                </button>
                <button
                  className={`px-3 py-1.5 flex items-center gap-2 rounded border ${
                    trainingTab === 'key'
                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                      : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setTrainingTab('key')}
                >
                  <Tag size={16} className="text-indigo-600" />
                  <span>Keywords</span>
                </button>
              </div>
            </div>

            {/* Right side: Import, number input, Generate, Clear */}
            <div className="flex items-center gap-2">
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
              <input
                type="number"
                min={1}
                max={50}
                value={genN}
                onChange={e => setGenN(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                className="w-14 px-2 py-1 rounded-md border"
                title="Numero di frasi da generare"
              />
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
              {!generating && lastGen && (
                <span
                  className={[
                    'px-2 py-0.5 rounded border',
                    lastGen.count === 0 ? 'bg-rose-100 text-rose-700 border-rose-200' :
                    lastGen.count < lastGen.requested ? 'bg-amber-100 text-amber-800 border-amber-200' :
                    'bg-emerald-100 text-emerald-700 border-emerald-200'
                  ].join(' ')}
                  title={`Generated ${lastGen.count} of ${lastGen.requested}`}
                >
                  {lastGen.count}/{lastGen.requested}
                </span>
              )}
              <button
                onClick={handleClearTraining}
                disabled={currentTabCount === 0}
                className="p-1.5 rounded border bg-white hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Clear All Phrases"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <div className="p-3 flex-1 min-h-0">
            <CenterPane intentId={selectedId} tab={trainingTab} setTab={setTrainingTab} />
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


