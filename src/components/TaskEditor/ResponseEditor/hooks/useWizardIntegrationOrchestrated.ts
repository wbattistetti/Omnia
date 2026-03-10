// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * @deprecated Use useWizard() from TaskBuilderAIWizard/hooks/useWizard instead
 *
 * Wizard Integration (Orchestrated)
 *
 * Uses WizardOrchestrator as SINGLE SOURCE OF TRUTH.
 * NO direct store access, NO side effects, NO legacy code.
 *
 * This hook is deprecated and will be removed in a future version.
 * Use the unified useWizard() hook instead.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useWizardOrchestrator } from '../../../../../TaskBuilderAIWizard/core/WizardOrchestrator';
import { useWizardSync } from '../../../../../TaskBuilderAIWizard/hooks/useWizardSync';
import { useWizardStore } from '../../../../../TaskBuilderAIWizard/store/wizardStore';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';
import { convertApiStructureToWizardTaskTree } from '../../../../../TaskBuilderAIWizard/utils/convertApiStructureToWizardTaskTree';

const EMPTY_MODULES: any[] = [];

export function useWizardIntegrationOrchestrated(
  taskLabel?: string,
  rowId?: string,
  projectId?: string,
  locale: string = 'it',
  onTaskBuilderComplete?: (taskTree: any) => void,
  mode?: 'full' | 'adaptation',
  templateId?: string
) {
  let addTranslation: ((guid: string, text: string) => void) | undefined;
  try {
    const { addTranslation: addTranslationFromContext } = useProjectTranslations();
    addTranslation = addTranslationFromContext;
  } catch {
    addTranslation = undefined;
  }

  const orchestrator = useWizardOrchestrator({
    taskLabel: taskLabel || '',
    rowId,
    projectId,
    locale,
    onTaskBuilderComplete,
    addTranslation,
    templateId, // ✅ Pass templateId for adaptation mode
  });

  // ✅ Get store setter for useWizardSync (variable sync needs to update dataSchema)
  const store = useWizardStore();

  const wizardSync = useWizardSync({
    dataSchema: orchestrator.dataSchema,
    setDataSchema: store.setDataSchema, // ✅ Variable sync needs to update dataSchema with variable names
    taskLabel: taskLabel || '',
    rowId,
    projectId,
    locale,
  });

  const hasStartedRef = useRef(false);

  // ✅ Handler per inviare correzione e rigenerare struttura
  const handleCorrectionSubmit = useCallback(async () => {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔄 [handleCorrectionSubmit] CALLED (Orchestrated)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[handleCorrectionSubmit] 📊 Initial state:', {
      hasTaskLabel: !!taskLabel,
      taskLabel,
      hasCorrectionInput: !!orchestrator.correctionInput,
      correctionInputLength: orchestrator.correctionInput?.trim().length || 0,
      correctionInput: orchestrator.correctionInput,
      dataSchemaLength: orchestrator.dataSchema.length
    });

    if (!taskLabel || !orchestrator.correctionInput?.trim()) {
      console.warn('[handleCorrectionSubmit] ❌ Validation failed:', {
        missingTaskLabel: !taskLabel,
        missingCorrectionInput: !orchestrator.correctionInput?.trim()
      });
      return;
    }

    const feedback = orchestrator.correctionInput.trim();
    const previousStructure = orchestrator.dataSchema;

    if (previousStructure.length === 0) {
      console.warn('[handleCorrectionSubmit] ❌ No previous structure to regenerate');
      return;
    }

    console.log('[handleCorrectionSubmit] ✅ Validation passed, starting regeneration...');

    try {
      console.log('[handleCorrectionSubmit] 📝 STEP 1: Closing correction form...');
      // ✅ STEP 1: Chiudi form (esci da DATA_STRUCTURE_CORRECTION → DATA_STRUCTURE_PROPOSED)
      store.setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
      console.log('[handleCorrectionSubmit] ✅ STEP 1: Form closed');

      console.log('[handleCorrectionSubmit] 📝 STEP 2: Clearing input...');
      // ✅ STEP 2: Pulisci input
      store.setCorrectionInput('');
      console.log('[handleCorrectionSubmit] ✅ STEP 2: Input cleared');

      console.log('[handleCorrectionSubmit] 📝 STEP 3: Resetting structureConfirmed...');
      // ✅ STEP 3: Reset struttura confermata (per far apparire Sì/No dopo)
      store.setStructureConfirmed(false);
      console.log('[handleCorrectionSubmit] ✅ STEP 3: structureConfirmed reset to false');

      console.log('[handleCorrectionSubmit] 📝 STEP 4: Setting step to running...');
      // ✅ STEP 4: Imposta step a 'running' con messaggio "sto pensando..." (come in WizardOrchestrator.start())
      store.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');
      console.log('[handleCorrectionSubmit] ✅ STEP 4: Step set to running');

      console.log('[handleCorrectionSubmit] 📝 STEP 5: Converting structure to SchemaNode[]...');
      // Convert WizardTaskTreeNode[] to SchemaNode[] format
      const convertToSchemaNodes = (nodes: WizardTaskTreeNode[]): any[] => {
        return nodes.map(node => ({
          id: node.id,
          label: node.label,
          type: node.type || 'text',
          icon: node.emoji,
          subData: node.subNodes ? convertToSchemaNodes(node.subNodes) : [],
          subTasks: node.subNodes ? convertToSchemaNodes(node.subNodes) : []
        }));
      };

      const schemaNodes = convertToSchemaNodes(previousStructure);
      console.log('[handleCorrectionSubmit] ✅ STEP 5: Structure converted', {
        schemaNodesCount: schemaNodes.length,
        firstNodeLabel: schemaNodes[0]?.label
      });

      console.log('[handleCorrectionSubmit] 📝 STEP 6: Importing regenerateStructure service...');
      // Import regenerateStructure service
      const { regenerateStructure } = await import('../../../../wizard/services/structureGenerationService');
      const provider = (localStorage.getItem('omnia.aiProvider') as 'openai' | 'groq') || 'openai';
      console.log('[handleCorrectionSubmit] ✅ STEP 6: Service imported', { provider });

      console.log('[handleCorrectionSubmit] 📝 STEP 7: Calling regenerateStructure API...', {
        taskLabel,
        feedbackLength: feedback.length,
        schemaNodesCount: schemaNodes.length,
        provider
      });
      // ✅ STEP 5: Chiama API per rigenerare struttura
      const result = await regenerateStructure(taskLabel, feedback, schemaNodes, provider);
      console.log('[handleCorrectionSubmit] ✅ STEP 7: API call completed', {
        success: result.success,
        hasStructure: !!result.structure,
        error: result.error
      });

      if (result.success && result.structure) {
        console.log('[handleCorrectionSubmit] 📝 STEP 8: Converting result back to WizardTaskTreeNode[]...');

        // ✅ FIX: Use convertApiStructureToWizardTaskTree (generates valid UUIDs, ignores AI ids like 'root')
        const newDataSchema = convertApiStructureToWizardTaskTree(result.structure, rowId || '');

        console.log('[handleCorrectionSubmit] ✅ STEP 8: Structure converted back', {
          newDataSchemaLength: newDataSchema.length,
          firstNodeLabel: newDataSchema[0]?.label,
          firstNodeId: newDataSchema[0]?.id
        });

        console.log('[handleCorrectionSubmit] 📝 STEP 9: Updating dataSchema...');
        store.setDataSchema(newDataSchema);
        console.log('[handleCorrectionSubmit] ✅ STEP 9: dataSchema updated');

        console.log('[handleCorrectionSubmit] 📝 STEP 10: Updating step message...');
        // ✅ STEP 7: Aggiorna step a 'running' con messaggio "Confermami..." (come in WizardOrchestrator.start())
        store.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
        console.log('[handleCorrectionSubmit] ✅ STEP 10: Step message updated');
        console.log('[handleCorrectionSubmit] ✅✅✅ REGENERATION COMPLETED SUCCESSFULLY ✅✅✅');
      } else {
        console.error('[handleCorrectionSubmit] ❌ Regeneration failed:', result.error);
        store.updatePipelineStep('structure', 'failed', result.error || 'Errore durante la rigenerazione');
      }
    } catch (error) {
      console.error('[handleCorrectionSubmit] ❌❌❌ ERROR:', error);
      console.error('[handleCorrectionSubmit] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      store.updatePipelineStep('structure', 'failed', error instanceof Error ? error.message : 'Errore sconosciuto');
    }
    console.log('═══════════════════════════════════════════════════════════════════════════');
  }, [
    taskLabel,
    orchestrator.correctionInput,
    orchestrator.dataSchema,
    store
  ]);

  // ✅ Auto-start wizard when taskLabel is available (full mode) or templateId is available (adaptation mode)
  useEffect(() => {
    // Full mode: start with taskLabel
    if (
      mode !== 'adaptation' &&
      taskLabel?.trim() &&
      orchestrator.wizardMode === WizardMode.START &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
      // ✅ Use new startFull() method
      if (orchestrator.startFull) {
        orchestrator.startFull()
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizardIntegrationOrchestrated] ❌ Error in startFull:', error);
            hasStartedRef.current = false;
          });
      } else {
        // Fallback to legacy start() method
        orchestrator.start()
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizardIntegrationOrchestrated] ❌ Error in start:', error);
            hasStartedRef.current = false;
          });
      }
    }

    // Adaptation mode: start with templateId
    if (
      mode === 'adaptation' &&
      templateId &&
      orchestrator.wizardMode === WizardMode.START &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
      // ✅ Use new startAdaptation() method
      if (orchestrator.startAdaptation) {
        orchestrator.startAdaptation(templateId)
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizardIntegrationOrchestrated] ❌ Error in startAdaptation:', error);
            hasStartedRef.current = false;
          });
      } else if (orchestrator.startAdaptationMode) {
        // Fallback to legacy startAdaptationMode() method
        orchestrator.startAdaptationMode(templateId)
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizardIntegrationOrchestrated] ❌ Error in startAdaptationMode:', error);
            hasStartedRef.current = false;
          });
      }
    }
  }, [taskLabel, templateId, mode, orchestrator.wizardMode, orchestrator, wizardSync]);

  return {
    // State (read-only from orchestrator)
    wizardMode: orchestrator.wizardMode,
    currentStep: orchestrator.currentStep,
    pipelineSteps: orchestrator.pipelineSteps,
    dataSchema: orchestrator.dataSchema,
    // ✅ NEW: Phase counters (source of truth for progress)
    phaseCounters: orchestrator.phaseCounters,

    // UI state
    showStructureConfirmation: orchestrator.showStructureConfirmation,
    structureConfirmed: orchestrator.structureConfirmed,
    showCorrectionMode: orchestrator.showCorrectionMode,
    correctionInput: orchestrator.correctionInput,
    setCorrectionInput: orchestrator.setCorrectionInput,

    // Handlers (only through orchestrator)
    // ✅ Unified: confirmStructure() now handles both full and adaptation modes
    handleStructureConfirm: orchestrator.confirmStructure,
    handleStructureReject: orchestrator.rejectStructure,
    runGenerationPipeline: orchestrator.start, // For compatibility
    handleCorrectionSubmit,

    // Data
    messages: orchestrator.messages,
    messagesGeneralized: orchestrator.messagesGeneralized,
    messagesContextualized: orchestrator.messagesContextualized,
    shouldBeGeneral: orchestrator.shouldBeGeneral,
    generalizedLabel: orchestrator.dataSchema?.[0]?.generalizedLabel || null,
    generalizationReason: orchestrator.dataSchema?.[0]?.generalizationReason || null,
    generalizedMessages: orchestrator.dataSchema?.[0]?.generalizedMessages || null,
    constraints: orchestrator.constraints,
    nlpContract: orchestrator.nlpContract,

    currentParserSubstep: orchestrator.currentParserSubstep,
    currentMessageSubstep: orchestrator.currentMessageSubstep,

    // Module handlers (only through orchestrator)
    onProceedFromEuristica: orchestrator.proceedFromEuristica,
    onShowModuleList: orchestrator.showModuleList,
    onSelectModule: orchestrator.selectModule,
    onPreviewModule: orchestrator.setActiveNodeId,
    availableModules: EMPTY_MODULES,
    foundModuleId: orchestrator.selectedModuleId,
  };
}
