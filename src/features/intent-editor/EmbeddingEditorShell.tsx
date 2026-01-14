import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { getModelStatus, trainIntent, TrainingPhrase } from './services/trainingService';
import { useIntentStore } from './state/intentStore';
// ✅ RIPRISTINO LAYOUT: Import dei componenti del layout completo
import { LeftGrid } from './ui/LeftGrid';
import { CenterPane } from './ui/CenterPane';
import { TestConsole } from './ui/RightTest';
// ✅ FIX DOPPIO HEADER: Import per Train Model button
import { Brain, Loader2 } from 'lucide-react';

interface EmbeddingEditorShellProps {
  inlineMode?: boolean;
  intentSelected?: string; // Not used anymore, but kept for backward compatibility
  instanceId?: string; // Not used anymore, but kept for backward compatibility
  onTrainStateChange?: (state: { training: boolean; modelReady: boolean; canTrain: boolean }) => void;
  // ✅ FIX DOPPIO HEADER: Esponi training state per mostrare Train Model button
  training?: boolean;
  modelReady?: boolean;
  canTrain?: boolean;
}

export interface EmbeddingEditorShellRef {
  handleTrain: () => Promise<void>;
  training: boolean;
  modelReady: boolean;
  canTrain: boolean;
}

// Available base models for embeddings
const BASE_MODELS = [
  { value: 'bge', label: 'BGE (BAAI General Embedding)' },
  { value: 'e5', label: 'E5 (Embedding for Everything Everywhere)' },
  { value: 'minilm', label: 'MiniLM' },
  { value: 'nomic-embed', label: 'Nomic Embed' },
  { value: 'sbert', label: 'SBERT (Sentence-BERT)' },
  { value: 'gte', label: 'GTE (General Text Embedding)' },
  { value: 'instructor-xl', label: 'Instructor XL' },
  { value: 'fasttext', label: 'FastText' },
  { value: 'openai', label: 'OpenAI Embedding (text-embedding-3)' },
];

const EmbeddingEditorShell = forwardRef<EmbeddingEditorShellRef, EmbeddingEditorShellProps>(
  ({ inlineMode = false, onTrainStateChange, training: externalTraining, modelReady: externalModelReady, canTrain: externalCanTrain }, ref) => {
    // Training state
    const [training, setTraining] = useState(false);
    const [modelReady, setModelReady] = useState(false);

    // ✅ FIX DOPPIO HEADER: Usa stato esterno se fornito, altrimenti stato interno
    const currentTraining = externalTraining !== undefined ? externalTraining : training;
    const currentModelReady = externalModelReady !== undefined ? externalModelReady : modelReady;

    // Training configuration parameters (not persisted yet)
    const [threshold, setThreshold] = useState<number>(0.6); // 0.0-1.0
    const [topK, setTopK] = useState<number>(5); // Number of top results
    const [baseModel, setBaseModel] = useState<string>('bge'); // Base model selection
    const [alpha, setAlpha] = useState<number>(0.5); // 0-1

    // Get all intents from store for training
    const intents = useIntentStore(s => s.intents || []);

    // ✅ FIX: Calcola canTrain localmente basandosi sugli intenti disponibili
    // Verifica anche che ci siano frasi di training (matching o not-matching)
    const hasTrainingPhrases = intents.some(intent => {
      const positive = intent.variants?.curated || [];
      const negative = intent.variants?.hardNeg || [];
      return positive.length > 0 || negative.length > 0;
    });
    const canTrain = intents.length > 0 && hasTrainingPhrases && !currentTraining;

    // ✅ FIX: Usa sempre il calcolo locale, non lo stato esterno (che può essere obsoleto)
    const currentCanTrain = canTrain;

    // ✅ RIPRISTINO LAYOUT: Ottieni l'intento selezionato dallo store
    const selectedIntentId = useIntentStore(s => s.selectedId);

    // Handler for training (uses all intents from store)
    const handleTrain = async () => {
      console.log('[EmbeddingEditorShell][TRAIN][INIT] Training button clicked');
      console.log('[EmbeddingEditorShell][TRAIN][INIT] Current state:', {
        intentsCount: intents.length,
        currentTraining,
        modelReady: currentModelReady,
        canTrain: currentCanTrain
      });

      if (intents.length === 0) {
        console.warn('[EmbeddingEditorShell][TRAIN][VALIDATION] No intents available');
        alert('Aggiungi almeno un intento per fare training');
        return;
      }

      console.log('[EmbeddingEditorShell][TRAIN][COLLECT] Collecting phrases from intents...');
      console.log('[EmbeddingEditorShell][TRAIN][COLLECT] Intents:', intents.map(i => ({
        id: i.id,
        name: i.name,
        curatedCount: i.variants?.curated?.length || 0,
        hardNegCount: i.variants?.hardNeg?.length || 0
      })));

      // Collect all training phrases from all intents
      const allPhrases: TrainingPhrase[] = [];
      for (const intent of intents) {
        const positive = intent.variants?.curated || [];
        const negative = intent.variants?.hardNeg || [];

        console.log('[EmbeddingEditorShell][TRAIN][COLLECT] Intent:', {
          id: intent.id,
          name: intent.name,
          positiveCount: positive.length,
          negativeCount: negative.length,
          positivePhrases: positive.map(p => ({ id: p.id, text: p.text?.substring(0, 50) })),
          negativePhrases: negative.map(p => ({ id: p.id, text: p.text?.substring(0, 50) }))
        });

        allPhrases.push(
          ...positive.map(p => ({ id: p.id, text: p.text, type: 'matching' as const })),
          ...negative.map(p => ({ id: p.id, text: p.text, type: 'not-matching' as const }))
        );
      }

      console.log('[EmbeddingEditorShell][TRAIN][COLLECT] Total phrases collected:', {
        total: allPhrases.length,
        matching: allPhrases.filter(p => p.type === 'matching').length,
        notMatching: allPhrases.filter(p => p.type === 'not-matching').length,
        phrases: allPhrases.map(p => ({ id: p.id, type: p.type, text: p.text?.substring(0, 50) }))
      });

      if (allPhrases.length === 0) {
        console.warn('[EmbeddingEditorShell][TRAIN][VALIDATION] No phrases available for training');
        alert('Aggiungi almeno una frase matching o not-matching per fare training');
        return;
      }

      const startTime = Date.now();
      try {
        console.log('[EmbeddingEditorShell][TRAIN][STATE] Setting training state to true');
        setTraining(true);
        onTrainStateChange?.({ training: true, modelReady, canTrain: false });

        console.log('[EmbeddingEditorShell][TRAIN][START] Starting training process', {
          timestamp: new Date().toISOString(),
          intentsCount: intents.length,
          phrasesCount: allPhrases.length,
          matchingCount: allPhrases.filter(p => p.type === 'matching').length,
          notMatchingCount: allPhrases.filter(p => p.type === 'not-matching').length,
          config: { threshold, topK, baseModel, alpha }
        });

        // TODO: Pass configuration parameters to trainIntent when backend supports it
        // For now, train with first intent ID (legacy behavior)
        const firstIntentId = intents[0]?.id;
        console.log('[EmbeddingEditorShell][TRAIN][PREPARE] Using first intent ID:', firstIntentId);

        if (!firstIntentId) {
          console.error('[EmbeddingEditorShell][TRAIN][ERROR] No intent ID found');
          throw new Error('No intent found');
        }

        console.log('[EmbeddingEditorShell][TRAIN][CALL] Calling trainIntent service...', {
          intentId: firstIntentId,
          phrasesCount: allPhrases.length,
          requestBody: {
            intentId: firstIntentId,
            phrasesCount: allPhrases.length,
            samplePhrases: allPhrases.slice(0, 3).map(p => ({ id: p.id, type: p.type, text: p.text?.substring(0, 30) }))
          }
        });

        const result = await trainIntent({
          intentId: firstIntentId,
          phrases: allPhrases,
          // Future: config: { threshold, topK, baseModel, alpha }
        });

        const elapsedTime = Date.now() - startTime;
        console.log('[EmbeddingEditorShell][TRAIN][RESULT] Training completed successfully', {
          timestamp: new Date().toISOString(),
          elapsedMs: elapsedTime,
          elapsedSeconds: (elapsedTime / 1000).toFixed(2),
          result: result
        });

        setModelReady(result.modelReady);
        console.log('[EmbeddingEditorShell][TRAIN][COMPLETE] Training process finished', {
          intentsCount: intents.length,
          phrasesCount: allPhrases.length,
          modelReady: result.modelReady,
          stats: result.stats,
          config: { threshold, topK, baseModel, alpha },
          totalTimeMs: elapsedTime
        });

        // ✅ ENTERPRISE: Emit event to notify components that training is complete
        window.dispatchEvent(new CustomEvent('trainingCompleted', {
          detail: {
            intentId: firstIntentId,
            modelReady: result.modelReady,
            stats: result.stats
          }
        }));

        // ✅ Mostra messaggio di successo con statistiche
        const stats = result.stats;
        const successMsg = `Training completato con successo!\n\n` +
          `Statistiche:\n` +
          `- Frasi matching: ${stats.matching}\n` +
          `- Frasi not-matching: ${stats.notMatching}\n` +
          `- Totale processate: ${stats.processed}\n` +
          `- Fallite: ${stats.failed}\n` +
          `- Modello pronto: ${result.modelReady ? 'Sì' : 'No'}\n` +
          `- Tempo impiegato: ${(elapsedTime / 1000).toFixed(2)} secondi`;
        alert(successMsg);
      } catch (err) {
        const elapsedTime = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : 'Training failed';
        const errorDetails = {
          timestamp: new Date().toISOString(),
          elapsedMs: elapsedTime,
          error: err,
          message: errorMsg,
          name: err instanceof Error ? err.name : 'Unknown',
          stack: err instanceof Error ? err.stack : undefined,
          intentsCount: intents.length,
          phrasesCount: allPhrases.length
        };

        console.error('[EmbeddingEditorShell][TRAIN][ERROR] Training failed', errorDetails);
        console.error('[EmbeddingEditorShell][TRAIN][ERROR] Full error object:', err);

        if (err instanceof Error) {
          console.error('[EmbeddingEditorShell][TRAIN][ERROR] Error name:', err.name);
          console.error('[EmbeddingEditorShell][TRAIN][ERROR] Error message:', err.message);
          console.error('[EmbeddingEditorShell][TRAIN][ERROR] Error stack:', err.stack);
        }

        alert(`Training failed: ${errorMsg}\n\nTempo trascorso: ${(elapsedTime / 1000).toFixed(2)} secondi\n\nCheck the browser console and backend logs for details.`);
      } finally {
        const elapsedTime = Date.now() - startTime;
        // ✅ FIX: Assicurati che il training venga sempre resettato, anche in caso di errore
        console.log('[EmbeddingEditorShell][TRAIN][FINALLY] Resetting training state', {
          timestamp: new Date().toISOString(),
          totalTimeMs: elapsedTime,
          wasTraining: currentTraining
        });
        setTraining(false);
        const hasTrainingPhrases = intents.some(intent => {
          const positive = intent.variants?.curated || [];
          const negative = intent.variants?.hardNeg || [];
          return positive.length > 0 || negative.length > 0;
        });
        const newCanTrain = intents.length > 0 && hasTrainingPhrases;
        console.log('[EmbeddingEditorShell][TRAIN][FINALLY] New state:', {
          training: false,
          modelReady,
          canTrain: newCanTrain,
          hasTrainingPhrases
        });
        onTrainStateChange?.({ training: false, modelReady, canTrain: newCanTrain });
        console.log('[EmbeddingEditorShell][TRAIN][FINALLY] State reset complete');
      }
    };

    // Expose handleTrain via ref
    useImperativeHandle(ref, () => ({
      handleTrain,
      training: currentTraining,
      modelReady: currentModelReady,
      canTrain: currentCanTrain,
    }), [currentTraining, currentModelReady, currentCanTrain, intents.length]);

    // ✅ FIX: Aggiorna canTrain quando cambiano gli intenti o lo stato di training
    React.useEffect(() => {
      const hasTrainingPhrases = intents.some(intent => {
        const positive = intent.variants?.curated || [];
        const negative = intent.variants?.hardNeg || [];
        return positive.length > 0 || negative.length > 0;
      });
      const newCanTrain = intents.length > 0 && hasTrainingPhrases && !currentTraining;
      onTrainStateChange?.({
        training: currentTraining,
        modelReady: currentModelReady,
        canTrain: newCanTrain
      });
    }, [intents.length, intents, currentTraining, currentModelReady, onTrainStateChange]);

    // Check model status on mount (for all intents)
    React.useEffect(() => {
      console.log('[EmbeddingEditorShell][STATUS] Checking model status on mount', {
        intentsCount: intents.length,
        intents: intents.map(i => ({ id: i.id, name: i.name }))
      });

      if (intents.length > 0) {
        const firstIntentId = intents[0]?.id;
        if (firstIntentId) {
          console.log('[EmbeddingEditorShell][STATUS] Getting model status for intent:', firstIntentId);
          getModelStatus(firstIntentId)
            .then(status => {
              console.log('[EmbeddingEditorShell][STATUS] Model status received:', status);
              setModelReady(status.modelReady);
              const hasTrainingPhrases = intents.some(intent => {
                const positive = intent.variants?.curated || [];
                const negative = intent.variants?.hardNeg || [];
                return positive.length > 0 || negative.length > 0;
              });
              const newCanTrain = intents.length > 0 && hasTrainingPhrases && !currentTraining;
              console.log('[EmbeddingEditorShell][STATUS] Updating state:', {
                modelReady: status.modelReady,
                hasTrainingPhrases,
                canTrain: newCanTrain
              });
              onTrainStateChange?.({
                training: currentTraining,
                modelReady: status.modelReady,
                canTrain: newCanTrain
              });
            })
            .catch((err) => {
              console.warn('[EmbeddingEditorShell][STATUS] Failed to get model status (non-critical):', {
                error: err,
                errorMessage: err instanceof Error ? err.message : String(err),
                intentId: firstIntentId
              });
              // ✅ FIX: Non bloccare l'UI se il controllo di stato fallisce
              setModelReady(false);
              const hasTrainingPhrases = intents.some(intent => {
                const positive = intent.variants?.curated || [];
                const negative = intent.variants?.hardNeg || [];
                return positive.length > 0 || negative.length > 0;
              });
              const newCanTrain = intents.length > 0 && hasTrainingPhrases && !currentTraining;
              onTrainStateChange?.({
                training: currentTraining,
                modelReady: false,
                canTrain: newCanTrain
              });
            });
        } else {
          console.warn('[EmbeddingEditorShell][STATUS] No intent ID found');
          setModelReady(false);
          onTrainStateChange?.({
            training: currentTraining,
            modelReady: false,
            canTrain: false
          });
        }
      } else {
        console.log('[EmbeddingEditorShell][STATUS] No intents available');
        setModelReady(false);
        onTrainStateChange?.({
          training: currentTraining,
          modelReady: false,
          canTrain: false
        });
      }
    }, [intents.length, currentTraining, onTrainStateChange]);

    // ✅ SOLUZIONE ESPERTO: Rimuovere tutti i ResizeObserver e log di debug, usare solo flex-1 min-h-0
    return (
      <div className="flex gap-0 flex-1 min-w-0 min-h-0 overflow-hidden flex-col">
        {/* Riga parametri in alto - tutti sulla stessa riga */}
        {/* ✅ FIX ALTEZZA: Aggiungi flex-shrink-0 per evitare che i controlli vengano compressi */}
        <div className="flex items-center gap-4 px-4 pt-4 pb-2 flex-shrink-0" style={{ minHeight: '60px' }}>
          {/* Threshold slider - compatto */}
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Threshold: <span className="text-blue-600 font-semibold">{(threshold * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              style={{ minWidth: '96px' }}
            />
          </div>

          {/* TopK input - largo solo per 3 cifre */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Top K:
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={topK}
              onChange={(e) => setTopK(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
              className="w-16 px-2 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
              style={{ maxWidth: '64px' }}
            />
          </div>

          {/* Alpha slider - compatto */}
          <div className="flex items-center gap-2 min-w-0">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Alpha: <span className="text-blue-600 font-semibold">{(alpha * 100).toFixed(0)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-24 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              style={{ minWidth: '96px' }}
            />
          </div>

          {/* Spacer per spingere Base Model a destra */}
          <div style={{ flex: 1 }} />

          {/* Base model dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Base Model:
            </label>
            <select
              value={baseModel}
              onChange={(e) => setBaseModel(e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ minWidth: '320px' }}
            >
              {BASE_MODELS.map(model => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ FIX DOPPIO HEADER: Train Model button spostato qui dalla toolbar */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleTrain}
              disabled={!currentCanTrain || currentTraining}
              style={{
                padding: '6px 12px',
                border: '1px solid rgba(0,0,0,0.2)',
                borderRadius: 8,
                background: currentModelReady ? '#fef3c7' : 'transparent',
                color: currentModelReady ? '#92400e' : '#1e293b',
                cursor: currentCanTrain && !currentTraining ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: currentCanTrain && !currentTraining ? 1 : 0.6
              }}
              title={currentTraining ? 'Training in corso...' : currentModelReady ? 'Model ready - Click to retrain' : 'Train embeddings model'}
            >
              {currentTraining ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Brain size={14} />
                  Train Model
                </>
              )}
            </button>
          </div>
        </div>

        {/* ✅ SOLUZIONE ESPERTO: Layout completo a 3 colonne - usa solo flex-1 min-h-0 */}
        {!inlineMode && (
          <div className="flex-1 min-h-0 flex gap-2 px-2 pb-2" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch' }}>
            {/* Sinistra: Lista Intent - aggiungi height: 100% per forzare espansione verticale in flex row */}
            <div className="w-64 flex-shrink-0 flex flex-col min-h-0" style={{ height: '100%' }}>
              <LeftGrid />
            </div>

            {/* Centro: Frasi Matching/Not Matching - flex-1 per espansione orizzontale, height: 100% per verticale */}
            <div className="flex-1 min-w-0 flex flex-col min-h-0" style={{ height: '100%' }}>
              <CenterPane intentId={selectedIntentId} />
            </div>

            {/* Destra: Test Console - aggiungi height: 100% per forzare espansione verticale in flex row */}
            <div className="w-80 flex-shrink-0 flex flex-col min-h-0" style={{ height: '100%' }}>
              <TestConsole />
            </div>
          </div>
        )}
      </div>
    );
  }
);

EmbeddingEditorShell.displayName = 'EmbeddingEditorShell';

export default EmbeddingEditorShell;

