import { useState, useCallback, useMemo } from 'react';
import { Step, StepResult, OrchestratorState, Translations } from './types';
import { generateSteps, DataNode } from './stepGenerator';

// Permetti una funzione custom per generare gli step
export function useOrchestrator(
  data: DataNode,
  customGenerateSteps?: (data: DataNode) => Step[]
) {
  // Usa la funzione custom se fornita, altrimenti generateSteps
  const [steps, setSteps] = useState<Step[]>(() => {
    return customGenerateSteps ? customGenerateSteps(data) : generateSteps(data);
  });
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepError, setStepError] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [lastError, setLastError] = useState<Error | undefined>(undefined);
  const [debugModal, setDebugModal] = useState<{ step: Step; result: StepResult } | null>(null);
  const [translations, setTranslations] = useState<Translations>({});

  // Funzione per rigenerare gli step dopo che abbiamo la struttura con subData
  const regenerateStepsWithSubData = useCallback((structureData: DataNode) => {
    console.log('[DEBUG] Regenerating steps with subData:', structureData);
    const newSteps = customGenerateSteps ? customGenerateSteps(structureData) : generateSteps(structureData);
    setSteps(newSteps);
    // Continue with the next step after regenerating
    setCurrentStepIndex(prev => {
      console.log('[DEBUG] Continuing from step index:', prev);
      return prev; // Continue from current index
    });
    console.log('[DEBUG] New steps count:', newSteps.length);
  }, [customGenerateSteps]);

  // Avanza sequenzialmente
  const runNextStep = useCallback(async () => {
    setStepError(false);
    setStepLoading(true);
    const step = steps[currentStepIndex];
    try {
      if (!step) {
        setStepLoading(false);
        return;
      }
      
      console.log(`[DEBUG] Executing step ${currentStepIndex}: ${step.key} (${step.type})`);
      
      const result = await step.run();
      
      // Log results for subData steps
      if (step.type === 'subDataMessages' || step.type === 'subDataScripts') {
        console.log(`[DEBUG] SubData step result for ${step.key}:`, result);
        console.log(`[DEBUG] SubData payload content:`, JSON.stringify(result.payload, null, 2));
      }
      
      setStepResults(prev => [...prev, result]);
      
      // Se questo è il step suggestStructureAndConstraints, rigenera gli step con i subData
      if (step.key === 'suggestStructureAndConstraints' && result.payload?.mainData) {
        console.log('[DEBUG] Structure step completed, regenerating steps with subData');
        regenerateStepsWithSubData(result.payload.mainData);
      }
      
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
  }, [currentStepIndex, steps, regenerateStepsWithSubData]);

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