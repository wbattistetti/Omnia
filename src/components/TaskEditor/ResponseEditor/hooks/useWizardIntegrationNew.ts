// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * NEW Wizard Integration (using new store + pure functions)
 *
 * This replaces the old useWizardIntegration with a simpler architecture:
 * - Uses Zustand store (single source of truth)
 * - Uses pure action functions (no complex hooks)
 * - Maintains same API for backward compatibility
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useWizardStore } from '../../../../../TaskBuilderAIWizard/store/wizardStore';
import { useWizardNew } from '../../../../../TaskBuilderAIWizard/hooks/useWizardNew';
import { useWizardSync } from '../../../../../TaskBuilderAIWizard/hooks/useWizardSync';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import {
  createTemplateAndInstanceForProposed as createTemplateAndInstanceForProposedService,
  createTemplateAndInstanceForCompleted as createTemplateAndInstanceForCompletedService,
  buildTaskTreeWithContractsAndEngines
} from '../../../../../TaskBuilderAIWizard/services/WizardCompletionService';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';

const EMPTY_MODULES: any[] = [];

/**
 * NEW: Wizard Integration using new store architecture
 * Maintains same API as old useWizardIntegration for backward compatibility
 */
export function useWizardIntegrationNew(
  taskLabel?: string,
  rowId?: string,
  projectId?: string,
  locale: string = 'it',
  onTaskBuilderComplete?: (taskTree: any) => void
) {
  const store = useWizardStore();

  // Get addTranslation from context
  let addTranslation: ((guid: string, text: string) => void) | undefined;
  try {
    const { addTranslation: addTranslationFromContext } = useProjectTranslations();
    addTranslation = addTranslationFromContext;
  } catch {
    // Context not available, will use fallback in TemplateCreationService
    addTranslation = undefined;
  }

  // ✅ NEW: Direct wrapper functions using WizardCompletionService (no legacy hook)
  const createTemplateAndInstanceForProposed = useCallback(async () => {
    // ✅ POINT OF NO RETURN: If structure is already confirmed, this should never be called
    // But if it is (legacy code, race condition), block it immediately
    if (store.structureConfirmed) {
      console.warn('[useWizardIntegrationNew] ⚠️ createTemplateAndInstanceForProposed called after structure confirmation - blocked');
      return;
    }

    if (store.dataSchema.length === 0 || !rowId || !projectId) {
      console.warn('[useWizardIntegrationNew] ⚠️ Cannot create template+instance: missing data');
      return;
    }

    try {
      console.log('[useWizardIntegrationNew] 🚀 Creating template + instance for proposed structure', {
        dataSchemaLength: store.dataSchema.length,
        rowId,
        projectId
      });

      const { taskInstance, taskTree } = await createTemplateAndInstanceForProposedService(
        store.dataSchema,
        store.messages,
        store.messagesGeneralized,
        store.messagesContextualized,
        store.shouldBeGeneral,
        taskLabel || 'Task',
        rowId,
        projectId,
        addTranslation,
        false // adaptAllNormalSteps
      );

      console.log('[useWizardIntegrationNew] ✅ Template + instance created', {
        taskId: taskInstance?.id,
        hasTaskTree: !!taskTree
      });

      // Call onTaskBuilderComplete if taskTree was built
      if (taskTree && onTaskBuilderComplete) {
        console.log('[useWizardIntegrationNew] ✅ TaskTree built, calling onTaskBuilderComplete', {
          taskTreeNodesCount: taskTree.nodes?.length || 0,
          taskTreeId: taskTree.id
        });
        onTaskBuilderComplete(taskTree);
      }

      // ✅ CRITICAL: DO NOT restore DATA_STRUCTURE_PROPOSED here
      // This function is called:
      // 1. During initial structure generation (wizardMode = START) → runStructureGeneration already sets DATA_STRUCTURE_PROPOSED
      // 2. When user confirms (wizardMode = GENERATING) → we should NOT restore DATA_STRUCTURE_PROPOSED
      // The transition to DATA_STRUCTURE_PROPOSED is handled by runStructureGeneration, not here
    } catch (error) {
      console.error('[useWizardIntegrationNew] ❌ Error creating template+instance (non-blocking)', {
        error: error instanceof Error ? error.message : String(error)
      });
      // ✅ DO NOT restore DATA_STRUCTURE_PROPOSED on error either
      // The wizardMode should remain as-is (either START or GENERATING)
    }
  }, [store, taskLabel, rowId, projectId, addTranslation, onTaskBuilderComplete]);

  const createTemplateAndInstanceForCompleted = useCallback(async () => {
    // Guard: check wizardMode and dataSchema
    if (store.wizardMode !== WizardMode.GENERATING || store.dataSchema.length === 0) {
      console.log('[useWizardIntegrationNew] ⚠️ createTemplateAndInstanceForCompleted - Guard failed', {
        wizardMode: store.wizardMode,
        wizardModeEqualsGenerating: store.wizardMode === WizardMode.GENERATING,
        dataSchemaLength: store.dataSchema.length
      });
      return;
    }

    if (!rowId || !projectId) {
      console.error('[useWizardIntegrationNew] ❌ rowId and projectId are required');
      return;
    }

    try {
      console.log('[useWizardIntegrationNew] ✅ createTemplateAndInstanceForCompleted - Guard passed, proceeding');

      const taskInstance = await createTemplateAndInstanceForCompletedService(
        store.dataSchema,
        store.messages,
        store.messagesGeneralized,
        store.messagesContextualized,
        store.shouldBeGeneral,
        taskLabel || 'Task',
        rowId,
        projectId,
        addTranslation,
        false // adaptAllNormalSteps
      );

      console.log('[useWizardIntegrationNew] ✅ Template + instance created for completed wizard', {
        taskId: taskInstance?.id,
        templateId: taskInstance?.templateId
      });

      // Build TaskTree and generate contracts/engines
      try {
        const taskTree = await buildTaskTreeWithContractsAndEngines(
          taskInstance,
          projectId,
          store.dataSchema
        );

        if (taskTree && onTaskBuilderComplete) {
          console.log('[useWizardIntegrationNew] ✅ TaskTree built successfully, calling onTaskBuilderComplete', {
            taskTreeNodesCount: taskTree.nodes?.length || 0,
            taskTreeStepsCount: taskTree.steps ? Object.keys(taskTree.steps).length : 0
          });
          onTaskBuilderComplete(taskTree);
        }
      } catch (error) {
        // Non-blocking: log error but don't block wizard flow
        console.warn('[useWizardIntegrationNew] ⚠️ Error building TaskTree (non-blocking)', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } catch (error) {
      console.error('[useWizardIntegrationNew] ❌ Error in createTemplateAndInstanceForCompleted', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        wizardMode: store.wizardMode,
        dataSchemaLength: store.dataSchema.length,
        hasRowId: !!rowId,
        hasProjectId: !!projectId
      });
    }
  }, [store, taskLabel, rowId, projectId, addTranslation, onTaskBuilderComplete]);

  // Use new wizard hook with direct service functions
  const wizardNew = useWizardNew({
    taskLabel,
    rowId,
    locale,
    onTaskBuilderComplete,
    createTemplateAndInstanceForProposed,
    createTemplateAndInstanceForCompleted,
    transitionToCompleted: () => {
      // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
      // ✅ This hook should not be used - use useWizardIntegrationOrchestrated instead
      console.warn('[useWizardIntegrationNew] ⚠️ transitionToCompleted called - this hook is deprecated. Use orchestrator instead.');
    },
  });

  // Sync variables
  const wizardSync = useWizardSync({
    dataSchema: store.dataSchema,
    setDataSchema: store.setDataSchema,
    taskLabel: taskLabel || '',
    rowId,
    projectId,
    locale,
  });

  const hasStartedRef = useRef(false);

  // Auto-start generation when taskLabel is available
  useEffect(() => {
    if (taskLabel?.trim() &&
        store.wizardMode === WizardMode.START &&
        !hasStartedRef.current) {
      hasStartedRef.current = true;
      store.setCurrentStep('generazione_struttura');

      wizardNew.runStructureGeneration(taskLabel.trim(), rowId)
        .then(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          await wizardSync.syncVariables();
        })
        .catch((error) => {
          console.error('[useWizardIntegrationNew] ❌ Error in structure generation:', error);
          hasStartedRef.current = false;
        });
    }
  }, [taskLabel, rowId, store.wizardMode, wizardNew, wizardSync]);

  // Handlers
  const handleStructureConfirm = useCallback(async () => {
    // ❌ DEPRECATED: This hook should not be used - use useWizardIntegrationOrchestrated instead
    console.warn('[useWizardIntegrationNew] ⚠️ handleStructureConfirm called - this hook is deprecated. Use orchestrator instead.');

    // ✅ CRITICAL: POINT OF NO RETURN - Set this FIRST
    store.setStructureConfirmed(true);

    // ❌ REMOVED: store.updatePipelineStep() - orchestrator controls this
    // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
    // ✅ These should be handled by orchestrator.confirmStructure()

    // Now call the async operations (createTemplateAndInstanceForProposed, runParallelGeneration)
    await wizardNew.handleStructureConfirm();
  }, [store, wizardNew]);

  const handleStructureReject = useCallback(() => {
    wizardNew.handleStructureReject();
  }, [wizardNew]);

  const onProceedFromEuristica = useCallback(async () => {
    if (taskLabel) {
      hasStartedRef.current = false;
      store.reset();
      store.setCurrentStep('generazione_struttura');
      await wizardNew.runStructureGeneration(taskLabel.trim(), rowId);
      await wizardSync.syncVariables();
    }
  }, [taskLabel, rowId, store, wizardNew, wizardSync]);

  const onShowModuleList = useCallback(() => {
    // ❌ REMOVED: store.setWizardMode() - orchestrator controls this
    // ✅ This hook should not be used - use useWizardIntegrationOrchestrated instead
    console.warn('[useWizardIntegrationNew] ⚠️ onShowModuleList called - this hook is deprecated. Use orchestrator instead.');
    store.setCurrentStep('lista_moduli');
  }, [store]);

  const onSelectModule = useCallback(async (moduleId: string) => {
    if (taskLabel) {
      store.setSelectedModuleId(moduleId);
      hasStartedRef.current = false;
      store.reset();
      store.setCurrentStep('generazione_struttura');
      await wizardNew.runStructureGeneration(taskLabel.trim(), rowId);
      await wizardSync.syncVariables();
    }
  }, [taskLabel, rowId, store, wizardNew, wizardSync]);

  // Return same API as old useWizardIntegration
  // ✅ FIX: Remove useMemo - let React handle re-renders naturally
  // Zustand will trigger re-renders when store properties change
  // This ensures progress bar updates every time pipelineSteps changes
  return {
    // State wizard
    wizardMode: store.wizardMode,
    currentStep: store.currentStep,
    pipelineSteps: store.pipelineSteps,
    dataSchema: store.dataSchema,

    // Stato conferma struttura
    showStructureConfirmation: store.showStructureConfirmation(),
    // ✅ Access the boolean field directly (not the selector function)
    structureConfirmed: (store as any as { structureConfirmed: boolean }).structureConfirmed,
    showCorrectionMode: store.showCorrectionMode(),
    correctionInput: store.correctionInput,
    setCorrectionInput: store.setCorrectionInput,

    // Handlers
    handleStructureConfirm,
    handleStructureReject,
    runGenerationPipeline: wizardNew.runStructureGeneration,

    // Altri dati wizard
    messages: store.messages,
    messagesGeneralized: store.messagesGeneralized,
    messagesContextualized: store.messagesContextualized,
    shouldBeGeneral: store.shouldBeGeneral,
    generalizedLabel: store.dataSchema?.[0]?.generalizedLabel || null,
    generalizationReason: store.dataSchema?.[0]?.generalizationReason || null,
    generalizedMessages: store.dataSchema?.[0]?.generalizedMessages || null,
    constraints: store.constraints,
    nlpContract: store.nlpContract,

    // Sotto-stati
    currentParserSubstep: store.currentParserSubstep,
    currentMessageSubstep: store.currentMessageSubstep,

    // Altri metodi wizard
    onProceedFromEuristica,
    onShowModuleList,
    onSelectModule,
    onPreviewModule: store.setActiveNodeId,
    availableModules: EMPTY_MODULES,
    foundModuleId: store.selectedModuleId,
  };
}
