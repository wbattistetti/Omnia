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
        .catch((error) => {
          console.error('[useWizardNew] Error in structure generation:', error);
          hasStartedRef.current = false;
        });
      // ✅ NON chiamare createTemplateAndInstanceForProposed qui
      // Deve essere chiamato solo quando l'utente conferma la struttura (in handleStructureConfirm)
    }
  }, [taskLabel, rowId, locale, store.wizardMode, createTemplateAndInstanceForProposed]);

  // Handle structure confirmation
  const handleStructureConfirm = useCallback(async () => {
    // ✅ STEP 1: Create template + instance for proposed structure
    // NOTE: pipelineSteps is already updated to 'completed' in useWizardIntegrationNew.handleStructureConfirm
    // This ensures UI shows "Confermata!" immediately, not "sto pensando..."
    if (createTemplateAndInstanceForProposed) {
      await createTemplateAndInstanceForProposed();
    }

    // ✅ STEP 2: Pipeline step is already marked as completed (done in useWizardIntegrationNew)
    // store.updatePipelineStep('structure', 'completed', 'Confermata!'); // ← RIMOSSO, già fatto

    try {
      // ✅ STEP 3: Run parallel generation - completion check happens inside updatePhaseProgress
      await runParallelGeneration(store, locale, async (phase, taskId) => {
        // When taskId is 'all-complete', all phases are done
        if (taskId === 'all-complete' && createTemplateAndInstanceForCompleted && transitionToCompleted) {
          // Only call completion once (use a flag to prevent multiple calls)
          if (!checkCompletionIntervalRef.current) {
            checkCompletionIntervalRef.current = setTimeout(async () => {
              try {
                // Wait a bit more to ensure all state updates are applied
                await new Promise(resolve => setTimeout(resolve, 100));

                // Double-check completion before proceeding
                const completion = checkCompletion();
                console.log('[useWizardNew] 🔍 Completion check:', completion);

                if (completion.isComplete) {
                  console.log('[useWizardNew] ✅ All conditions met - creating template + instance');
                  await createTemplateAndInstanceForCompleted();
                  transitionToCompleted();
                } else {
                  console.warn('[useWizardNew] ⏳ Completion check failed, waiting...', completion);
                  // Retry after a short delay
                  checkCompletionIntervalRef.current = setTimeout(async () => {
                    const retryCompletion = checkCompletion();
                    if (retryCompletion.isComplete) {
                      console.log('[useWizardNew] ✅ Retry successful - creating template + instance');
                      await createTemplateAndInstanceForCompleted();
                      transitionToCompleted();
                    } else {
                      console.warn('[useWizardNew] ⏳ Retry also failed:', retryCompletion);
                    }
                    checkCompletionIntervalRef.current = null;
                  }, 500);
                  return; // Don't clear the ref yet
                }
              } catch (error) {
                console.error('[useWizardNew] Error in completion:', error);
              } finally {
                if (checkCompletionIntervalRef.current) {
                  checkCompletionIntervalRef.current = null;
                }
              }
            }, 200); // Use setTimeout to ensure all state updates are applied first
          }
        }
      });
    } catch (error) {
      console.error('[useWizardNew] Error in parallel generation:', error);
    }
  }, [store, locale, createTemplateAndInstanceForCompleted, transitionToCompleted]);

  // Handle structure rejection
  const handleStructureReject = useCallback(() => {
    // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
    // ✅ This hook should not be used - use useWizardIntegrationOrchestrated instead
    console.warn('[useWizardNew] ⚠️ handleStructureReject called - this hook is deprecated. Use orchestrator instead.');
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
    // ✅ Access the boolean field directly (not the selector function)
    structureConfirmed: (store as any as { structureConfirmed: boolean }).structureConfirmed,
    showCorrectionMode: store.showCorrectionMode(),
    correctionInput: store.correctionInput,
    setCorrectionInput: store.setCorrectionInput,
    activeNodeId: store.activeNodeId,
    setActiveNodeId: store.setActiveNodeId,

    // Handlers
    handleStructureConfirm,
    handleStructureReject,
    resetWizard,

    // Actions (wrapped for convenience)
    runStructureGeneration: useCallback((taskLabel: string, rowId?: string) =>
      runStructureGeneration(store, taskLabel, rowId, locale), [store, locale]),
    runParallelGeneration: useCallback(() => runParallelGeneration(store, locale), [store, locale]),
    checkCompletion: useCallback(() => checkCompletion(), [])
  };
}
