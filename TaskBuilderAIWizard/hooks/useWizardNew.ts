// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * New Wizard Hook (Simplified)
 *
 * Simple hook that uses the store and pure action functions.
 * No complex dependencies, no race conditions, no closures.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useWizardStore } from '../store/wizardStore';
import { runStructureGeneration, runParallelGeneration, checkCompletion } from '../actions/wizardActions';
import { WizardMode } from '../types/WizardMode';

interface UseWizardNewProps {
  taskLabel?: string;
  rowId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  createTemplateAndInstanceForProposed?: () => Promise<void>;
  createTemplateAndInstanceForCompleted?: () => Promise<void>;
  transitionToCompleted?: () => void;
}

/**
 * Simplified wizard hook using store + pure functions
 */
export function useWizardNew(props: UseWizardNewProps) {
  const {
    taskLabel,
    rowId,
    locale = 'it',
    onTaskBuilderComplete,
    createTemplateAndInstanceForProposed,
    createTemplateAndInstanceForCompleted,
    transitionToCompleted
  } = props;

  const store = useWizardStore();
  const hasStartedRef = useRef(false);
  const checkCompletionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start generation when taskLabel is available
  useEffect(() => {
    if (taskLabel?.trim() &&
        store.wizardMode === WizardMode.START &&
        !hasStartedRef.current) {
      hasStartedRef.current = true;

      runStructureGeneration(store, taskLabel.trim(), rowId, locale)
        .then(async () => {
          // Create template + instance for proposed structure
          if (createTemplateAndInstanceForProposed) {
            await createTemplateAndInstanceForProposed();
          }
        })
        .catch((error) => {
          console.error('[useWizardNew] Error in structure generation:', error);
          hasStartedRef.current = false;
        });
    }
  }, [taskLabel, rowId, locale, store.wizardMode, createTemplateAndInstanceForProposed]);

  // Handle structure confirmation
  const handleStructureConfirm = useCallback(async () => {
    store.updatePipelineStep('structure', 'completed', 'Confermata!');
    store.setWizardMode(WizardMode.GENERATING);

    try {
      // Run parallel generation - completion check happens inside updatePhaseProgress
      await runParallelGeneration(store, locale, async (phase, taskId) => {
        // When taskId is 'all-complete', all phases are done
        if (taskId === 'all-complete' && createTemplateAndInstanceForCompleted && transitionToCompleted) {
          // Only call completion once (use a flag to prevent multiple calls)
          if (!checkCompletionIntervalRef.current) {
            checkCompletionIntervalRef.current = setTimeout(async () => {
              try {
                // Double-check completion before proceeding
                const completion = checkCompletion(store);
                if (completion.isComplete) {
                  await createTemplateAndInstanceForCompleted();
                  transitionToCompleted();
                } else {
                  console.warn('[useWizardNew] Completion check failed:', completion);
                }
              } catch (error) {
                console.error('[useWizardNew] Error in completion:', error);
              } finally {
                checkCompletionIntervalRef.current = null;
              }
            }, 0); // Use setTimeout to ensure all state updates are applied first
          }
        }
      });
    } catch (error) {
      console.error('[useWizardNew] Error in parallel generation:', error);
    }
  }, [store, locale, createTemplateAndInstanceForCompleted, transitionToCompleted]);

  // Handle structure rejection
  const handleStructureReject = useCallback(() => {
    store.setWizardMode(WizardMode.DATA_STRUCTURE_CORRECTION);
  }, [store]);

  // Reset wizard
  const resetWizard = useCallback(() => {
    hasStartedRef.current = false;
    store.reset();
  }, [store]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (checkCompletionIntervalRef.current) {
        clearInterval(checkCompletionIntervalRef.current);
      }
    };
  }, []);

  return {
    // State from store
    wizardMode: store.wizardMode,
    currentStep: store.currentStep,
    dataSchema: store.dataSchema,
    pipelineSteps: store.pipelineSteps,
    messages: store.messages,
    messagesGeneralized: store.messagesGeneralized,
    shouldBeGeneral: store.shouldBeGeneral,
    showStructureConfirmation: store.showStructureConfirmation(),
    structureConfirmed: store.structureConfirmed(),
    showCorrectionMode: store.showCorrectionMode(),
    correctionInput: store.correctionInput,
    setCorrectionInput: store.setCorrectionInput,
    activeNodeId: store.activeNodeId,
    setActiveNodeId: store.setActiveNodeId,

    // Handlers
    handleStructureConfirm,
    handleStructureReject,
    resetWizard,

    // Actions
    runStructureGeneration: (taskLabel: string, rowId?: string) =>
      runStructureGeneration(store, taskLabel, rowId, locale),
    runParallelGeneration: () => runParallelGeneration(store, locale),
    checkCompletion: () => checkCompletion(store)
  };
}
