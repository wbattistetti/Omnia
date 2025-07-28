import { useState, useCallback, useMemo } from 'react';
import { Step, StepResult, OrchestratorState, Translations } from './types';
import { generateSteps, DataNode } from './stepGenerator';

export function useOrchestrator(data: DataNode) {
  // Correzione: usa useMemo per generare gli step solo quando data cambia
  const steps = useMemo(() => generateSteps(data), [data]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepError, setStepError] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [lastError, setLastError] = useState<Error | undefined>(undefined);
  const [debugModal, setDebugModal] = useState<{ step: Step; result: StepResult } | null>(null);
  const [translations, setTranslations] = useState<Translations>({});

  // Avanza sequenzialmente
  const runNextStep = useCallback(async () => {
    setStepError(false);
    setStepLoading(true);
    const step = steps[currentStepIndex];
    try {
      const result = await step.run();
      setStepResults(prev => [...prev, result]);
      // Raccogli translations se presenti
      if (result.translations) {
        setTranslations(prev => ({ ...prev, ...result.translations }));
      }
      setDebugModal({ step, result }); // Mostra modale di debug
      setStepLoading(false);
    } catch (e: any) {
      setStepError(true);
      setLastError(e);
      setStepLoading(false);
    }
  }, [steps, currentStepIndex]);

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