import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { classify } from '../services/inferenceService';
import { getModelStatus } from '../services/trainingService';
import { useIntentStore } from '../state/intentStore';
import type { ClassificationResult } from '../ui/CenterPane/ClassificationBadge';

/**
 * Custom hook for classifying training phrases
 * Enterprise-ready: Clean, efficient, event-driven
 */
export function usePhraseClassification(
  intentId: string,
  phrases: Array<{ id: string; text: string; type: 'matching' | 'not-matching' }>,
  enabled: boolean = true
) {
  const [results, setResults] = useState<Map<string, ClassificationResult>>(new Map());
  const [isClassifying, setIsClassifying] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const intents = useIntentStore(s => s.intents || []);

  // Generate stable key from phrases for dependency tracking
  const phrasesKey = useMemo(
    () => phrases.map(p => `${p.id}:${p.text}`).join('|'),
    [phrases]
  );

  // Stable reference to phrases
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  // Check model status on mount and when training completes
  useEffect(() => {
    if (!enabled || !intentId || intents.length === 0) {
      setModelReady(false);
      return;
    }

    let cancelled = false;

    const checkModel = async () => {
      try {
        // Training saves embeddings for first intent
        const firstIntentId = intents[0]?.id;
        if (!firstIntentId) {
          if (!cancelled) setModelReady(false);
          return;
        }

        const status = await getModelStatus(firstIntentId);
        if (!cancelled) {
          setModelReady(status.modelReady);
        }
      } catch (err) {
        if (!cancelled) {
          setModelReady(false);
        }
      }
    };

    // Check immediately
    checkModel();

    // Listen for training completion
    const handleTrainingComplete = () => {
      if (!cancelled) {
        checkModel();
      }
    };

    window.addEventListener('trainingCompleted' as any, handleTrainingComplete);

    return () => {
      cancelled = true;
      window.removeEventListener('trainingCompleted' as any, handleTrainingComplete);
    };
  }, [intentId, enabled, intents.length]);

  // Classify phrases when model becomes ready
  const classifyPhrases = useCallback(async () => {
    if (!enabled || !modelReady || phrasesRef.current.length === 0 || intents.length === 0) {
      return;
    }

    setIsClassifying(true);
    const newResults = new Map<string, ClassificationResult>();

    // Mark all as loading
    phrasesRef.current.forEach(phrase => {
      newResults.set(phrase.id, {
        intentId: undefined,
        intentName: '',
        score: 0,
        isCorrect: false,
        loading: true
      });
    });
    setResults(new Map(newResults));

    try {
      // Classify each phrase
      for (const phrase of phrasesRef.current) {
        try {
          const classification = await classify(phrase.text, intents);
          const recognizedIntentId = classification.intentId;
          const recognizedIntent = intents.find(i => i.id === recognizedIntentId);
          const recognizedIntentName = recognizedIntent?.name || 'Nessun intento';

          // Determine if classification is correct
          let isCorrect = false;
          if (phrase.type === 'matching') {
            isCorrect = recognizedIntentId === intentId;
          } else {
            isCorrect = recognizedIntentId !== intentId;
          }

          newResults.set(phrase.id, {
            intentId: recognizedIntentId,
            intentName: recognizedIntentName,
            score: classification.score,
            isCorrect,
            loading: false
          });

          // Update incrementally
          setResults(new Map(newResults));
        } catch (err) {
          newResults.set(phrase.id, {
            intentId: undefined,
            intentName: 'Errore',
            score: 0,
            isCorrect: false,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
          setResults(new Map(newResults));
        }
      }
    } finally {
      setIsClassifying(false);
    }
  }, [enabled, modelReady, intents, intentId]);

  // Trigger classification when model becomes ready or phrases change
  useEffect(() => {
    if (modelReady && phrasesRef.current.length > 0 && intents.length > 0) {
      // Classify immediately when phrases change or model becomes ready
      classifyPhrases();
    } else {
      setResults(new Map());
    }
  }, [modelReady, phrasesKey, classifyPhrases, intents.length, intentId]);

  return {
    results,
    isClassifying,
    modelReady,
    classifyPhrases
  };
}
