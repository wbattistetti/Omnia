import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { getModelStatus, trainIntent, TrainingPhrase } from './services/trainingService';
import { useIntentStore } from './state/intentStore';

interface EmbeddingEditorShellProps {
  inlineMode?: boolean;
  intentSelected?: string; // Not used anymore, but kept for backward compatibility
  instanceId?: string; // Not used anymore, but kept for backward compatibility
  onTrainStateChange?: (state: { training: boolean; modelReady: boolean; canTrain: boolean }) => void;
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
  ({ inlineMode = false, onTrainStateChange }, ref) => {
    // Training state
    const [training, setTraining] = useState(false);
    const [modelReady, setModelReady] = useState(false);

    // Training configuration parameters (not persisted yet)
    const [threshold, setThreshold] = useState<number>(0.6); // 0.0-1.0
    const [topK, setTopK] = useState<number>(5); // Number of top results
    const [baseModel, setBaseModel] = useState<string>('bge'); // Base model selection
    const [alpha, setAlpha] = useState<number>(0.5); // 0-1

    // Get all intents from store for training
    const intents = useIntentStore(s => s.intents || []);
    const canTrain = intents.length > 0 && !training;

    // Handler for training (uses all intents from store)
    const handleTrain = async () => {
      if (intents.length === 0) {
        alert('Aggiungi almeno un intento per fare training');
        return;
      }

      // Collect all training phrases from all intents
      const allPhrases: TrainingPhrase[] = [];
      for (const intent of intents) {
        const positive = intent.variants?.curated || [];
        const negative = intent.variants?.hardNeg || [];

        allPhrases.push(
          ...positive.map(p => ({ id: p.id, text: p.text, type: 'matching' as const })),
          ...negative.map(p => ({ id: p.id, text: p.text, type: 'not-matching' as const }))
        );
      }

      if (allPhrases.length === 0) {
        alert('Aggiungi almeno una frase matching o not-matching per fare training');
        return;
      }

      try {
        setTraining(true);
        onTrainStateChange?.({ training: true, modelReady, canTrain: false });

        // TODO: Pass configuration parameters to trainIntent when backend supports it
        // For now, train with first intent ID (legacy behavior)
        const firstIntentId = intents[0]?.id;
        if (!firstIntentId) {
          throw new Error('No intent found');
        }

        const result = await trainIntent({
          intentId: firstIntentId,
          phrases: allPhrases,
          // Future: config: { threshold, topK, baseModel, alpha }
        });

        setModelReady(result.modelReady);
        console.log('[EmbeddingEditorShell][TRAIN][COMPLETE]', {
          intentsCount: intents.length,
          phrasesCount: allPhrases.length,
          modelReady: result.modelReady,
          config: { threshold, topK, baseModel, alpha }
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Training failed';
        console.error('[EmbeddingEditorShell][TRAIN][ERROR]', err);
        alert(`Training failed: ${errorMsg}`);
      } finally {
        setTraining(false);
        onTrainStateChange?.({ training: false, modelReady, canTrain: intents.length > 0 });
      }
    };

    // Expose handleTrain via ref
    useImperativeHandle(ref, () => ({
      handleTrain,
      training,
      modelReady,
      canTrain,
    }), [training, modelReady, canTrain, intents.length]);

    // Check model status on mount (for all intents)
    React.useEffect(() => {
      if (intents.length > 0) {
        const firstIntentId = intents[0]?.id;
        if (firstIntentId) {
          getModelStatus(firstIntentId).then(status => {
            setModelReady(status.modelReady);
            onTrainStateChange?.({ training, modelReady: status.modelReady, canTrain });
          }).catch(() => {
            setModelReady(false);
            onTrainStateChange?.({ training, modelReady: false, canTrain });
          });
        }
      } else {
        setModelReady(false);
        onTrainStateChange?.({ training, modelReady: false, canTrain: false });
      }
    }, [intents.length]);

    // Notify parent of state changes
    React.useEffect(() => {
      onTrainStateChange?.({ training, modelReady, canTrain });
    }, [training, modelReady, canTrain]);

    return (
      <div className="flex gap-0 h-full flex-1 min-w-0 overflow-hidden flex-col" style={{ maxWidth: '100%' }}>
        {/* Riga parametri in alto - tutti sulla stessa riga */}
        <div className="flex items-center gap-4 px-4 pt-4 pb-2" style={{ minHeight: '60px' }}>
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

          {/* Base model dropdown - alla fine a destra, largo per contenere l'opzione più lunga */}
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
        </div>
      </div>
    );
  }
);

EmbeddingEditorShell.displayName = 'EmbeddingEditorShell';

export default EmbeddingEditorShell;

