import { useState, useCallback, useMemo } from 'react';
import { Step, StepResult, OrchestratorState, Translations } from './types';
import { generateSteps, DataNode } from './stepGenerator';

// Permetti una funzione custom per generare gli step
export function useOrchestrator(
  data: DataNode,
  customGenerateSteps?: (data: DataNode) => Step[]
) {
  console.log('[useOrchestrator] MOUNT', { data });
  // Usa la funzione custom se fornita, altrimenti generateSteps
  const steps = useMemo(() => {
    console.log('[useOrchestrator] generateSteps', data);
    return customGenerateSteps ? customGenerateSteps(data) : generateSteps(data);
  }, [data, customGenerateSteps]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepError, setStepError] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [lastError, setLastError] = useState<Error | undefined>(undefined);
  const [debugModal, setDebugModal] = useState<{ step: Step; result: StepResult } | null>(null);
  const [translations, setTranslations] = useState<Translations>({});

  // Avanza sequenzialmente
  const runNextStep = useCallback(async () => {
    console.log('[useOrchestrator] runNextStep', { currentStepIndex, data, step: steps[currentStepIndex]?.key });
    setStepError(false);
    setStepLoading(true);
    const step = steps[currentStepIndex];
    try {
      if (!step) {
        console.log('[useOrchestrator] runNextStep: step non trovato per currentStepIndex', currentStepIndex);
        setStepLoading(false);
        return;
      }
      console.log('[useOrchestrator] runNextStep: eseguo step.run() per', step.key);
      const result = await step.run();
      console.log('[useOrchestrator] runNextStep: step.run() RISULTATO', result);
      setStepResults(prev => [...prev, result]);
      // Raccogli translations se presenti
      if (result.translations) {
        setTranslations(prev => ({ ...prev, ...result.translations }));
      }
      setDebugModal({ step, result }); // Mostra modale di debug
      setStepLoading(false);
    } catch (e: any) {
      console.error('[useOrchestrator] runNextStep: ERRORE', e);
      setStepError(true);
      setLastError(e);
      setStepLoading(false);
    }
  }, [currentStepIndex, data, steps]);

  // Chiudi modale e avanza
  const closeDebugModalAndContinue = useCallback(() => {
    setDebugModal(null);
    setCurrentStepIndex(idx => idx + 1);
  }, []);

  // Retry step corrente
  const retry = useCallback(() => {
    setStepError(false);
    setLastError(undefined);
    runNextStep();
  }, [runNextStep]);

  // Stato orchestratore
  const state: OrchestratorState = {
    steps,
    currentStepIndex,
    stepError,
    stepLoading,
    stepResults,
    lastError,
  };

  return {
    state,
    runNextStep,
    closeDebugModalAndContinue,
    retry,
    debugModal,
    translations,
  };
} 