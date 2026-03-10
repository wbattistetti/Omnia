// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useWizardState } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';
import { useWizardFlow } from '../../../../../TaskBuilderAIWizard/hooks/useWizardFlow';
// ❌ REMOVED: import { useWizardGeneration } from '../../../../../TaskBuilderAIWizard/hooks/useWizardGeneration';
// ✅ NEW: Use WizardOrchestrator hook
import { useWizardOrchestrator } from '../../../../../TaskBuilderAIWizard/hooks/useWizardOrchestrator';
import { useWizardSync } from '../../../../../TaskBuilderAIWizard/hooks/useWizardSync';
import { useWizardCompletion } from '../../../../../TaskBuilderAIWizard/hooks/useWizardCompletion';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';

const EMPTY_MODULES: any[] = [];

/**
 * @deprecated Use useWizard() from TaskBuilderAIWizard/hooks/useWizard instead
 *
 * Hook orchestratore che compone tutti gli hook del wizard.
 * Gestisce il flusso completo: stato, transizioni, generazione, sincronizzazione, completamento.
 * Espone API unificata per ResponseEditorLayout.
 *
 * This hook is deprecated and will be removed in a future version.
 * Use the unified useWizard() hook instead.
 */
export function useWizardIntegration(
  taskLabel?: string,
  rowId?: string, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
  projectId?: string,
  locale: string = 'it',
  onTaskBuilderComplete?: (taskTree: any) => void
) {
  // ============================================
  // HOOK COMPOSITION
  // ============================================

  const wizardState = useWizardState();
  const wizardFlow = useWizardFlow(wizardState.wizardMode, wizardState.setWizardMode);

  // ✅ NEW: Callback per segnalare che il primo step è completato (template + istanza pronti)
  const handleFirstStepComplete = useCallback(() => {
    console.log('[useWizardIntegration] ✅ First step complete - emitting DATA_STRUCTURE_PROPOSED');
    // ✅ Emetti DATA_STRUCTURE_PROPOSED solo DOPO che template + istanza sono pronti
    wizardFlow.transitionToProposed();
  }, [wizardFlow]);

  // ✅ Create wizardCompletion FIRST so we can pass createTemplateAndInstanceForProposed to wizardGeneration
  const wizardCompletion = useWizardCompletion({
    wizardState: wizardState.wizardMode, // ✅ RINOMINATO: wizardMode → wizardState (wizardState.wizardMode è il vecchio hook, manterremo per ora)
    dataSchema: wizardState.dataSchema,
    messages: wizardState.messages,
    messagesGeneralized: wizardState.messagesGeneralized,
    messagesContextualized: wizardState.messagesContextualized,
    shouldBeGeneral: wizardState.shouldBeGeneral,
    taskLabel,
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    projectId,
    transitionToCompleted: wizardFlow.transitionToCompleted,
    onTaskBuilderComplete,
    onFirstStepComplete: handleFirstStepComplete, // ✅ NEW: Callback per segnalare completamento primo step
  });

  const wizardSync = useWizardSync({
    dataSchema: wizardState.dataSchema,
    setDataSchema: wizardState.setDataSchema,
    taskLabel: taskLabel || '',
    rowId, // ✅ ALWAYS equals row.id (which equals task.id when task exists)
    projectId,
    locale,
  });

  // ✅ NEW: Use WizardOrchestrator instead of useWizardGeneration
  const wizardOrchestrator = useWizardOrchestrator({
    taskLabel: taskLabel || '',
    rowId,
    projectId,
    locale,
    onTaskBuilderComplete,
    // addTranslation can be added if needed
  });

  // ============================================
  // ORCHESTRATION - useEffect minimi
  // ============================================

  const hasStartedRef = useRef(false);

  // Avvia automaticamente la generazione quando taskLabel è disponibile
  useEffect(() => {
    if (taskLabel?.trim() &&
        wizardState.wizardMode === WizardMode.START &&
        !hasStartedRef.current) {
      hasStartedRef.current = true;
      wizardState.setCurrentStep('generazione_struttura');

      wizardOrchestrator.runGenerationPipeline(taskLabel.trim(), rowId)
        .then(async () => {
          // Wait a bit for state to update
          await new Promise(resolve => setTimeout(resolve, 100));

          // Sincronizza variabili dopo generazione struttura
          await wizardSync.syncVariables();
        })
        .catch((error) => {
          console.error('[useWizardIntegration] ❌ Errore in runGenerationPipeline:', error);
          hasStartedRef.current = false; // Reset per permettere retry
        });
    }
  }, [taskLabel, rowId, wizardState.wizardMode, wizardState.setCurrentStep, wizardGeneration, wizardSync]);

  // ❌ RIMOSSO COMPLETAMENTE: useEffect reattivo per checkAndComplete
  // ✅ MODELLO DETERMINISTICO: checkAndComplete viene chiamato direttamente da updatePhaseProgress
  // quando tutti i contatori sono completi. I contatori sono l'unica fonte di verità.
  // PipelineSteps è solo UI, non logica.

  // ============================================
  // HANDLERS - Orchestrazione
  // ============================================

  const handleStructureConfirm = useCallback(async () => {
    // Aggiorna messaggio struttura a "Confermata!"
    wizardState.updatePipelineStep('structure', 'completed', 'Confermata!');

    // Transizione a GENERATING (salta DATA_STRUCTURE_CONFIRMED)
    wizardFlow.transitionToGenerating();

    try {
      await wizardOrchestrator.continueAfterStructureConfirmation(wizardState.dataSchema);
    } catch (error) {
      console.error('[useWizardIntegration][handleStructureConfirm] ❌ Error:', error);
      throw error;
    }
  }, [
    wizardState.updatePipelineStep,
    wizardState.dataSchema,
    wizardState.setPipelineSteps,
    wizardFlow,
    wizardOrchestrator,
  ]);

  const handleStructureReject = useCallback(() => {
    wizardFlow.transitionToCorrection();
  }, [wizardFlow]);

  // ✅ Handler per inviare correzione e rigenerare struttura
  const handleCorrectionSubmit = useCallback(async () => {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔄 [handleCorrectionSubmit] CALLED');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('[handleCorrectionSubmit] 📊 Initial state:', {
      hasTaskLabel: !!taskLabel,
      taskLabel,
      hasCorrectionInput: !!wizardState.correctionInput,
      correctionInputLength: wizardState.correctionInput?.trim().length || 0,
      correctionInput: wizardState.correctionInput,
      dataSchemaLength: wizardState.dataSchema.length
    });

    if (!taskLabel || !wizardState.correctionInput?.trim()) {
      console.warn('[handleCorrectionSubmit] ❌ Validation failed:', {
        missingTaskLabel: !taskLabel,
        missingCorrectionInput: !wizardState.correctionInput?.trim()
      });
      return;
    }

    const feedback = wizardState.correctionInput.trim();
    const previousStructure = wizardState.dataSchema;

    if (previousStructure.length === 0) {
      console.warn('[handleCorrectionSubmit] ❌ No previous structure to regenerate');
      return;
    }

    console.log('[handleCorrectionSubmit] ✅ Validation passed, starting regeneration...');

    try {
      console.log('[handleCorrectionSubmit] 📝 STEP 1: Closing correction form...');
      // ✅ STEP 1: Chiudi form (esci da DATA_STRUCTURE_CORRECTION → DATA_STRUCTURE_PROPOSED)
      wizardFlow.transitionFromCorrection();
      console.log('[handleCorrectionSubmit] ✅ STEP 1: Form closed');

      console.log('[handleCorrectionSubmit] 📝 STEP 2: Clearing input...');
      // ✅ STEP 2: Pulisci input
      wizardState.setCorrectionInput('');
      console.log('[handleCorrectionSubmit] ✅ STEP 2: Input cleared');

      console.log('[handleCorrectionSubmit] 📝 STEP 3: Resetting structureConfirmed...');
      // ✅ STEP 3: Reset struttura confermata (per far apparire Sì/No dopo)
      wizardState.setStructureConfirmed(false);
      console.log('[handleCorrectionSubmit] ✅ STEP 3: structureConfirmed reset to false');

      console.log('[handleCorrectionSubmit] 📝 STEP 4: Setting step to running...');
      // ✅ STEP 4: Imposta step a 'running' con messaggio "sto pensando..." (come in WizardOrchestrator.start())
      wizardState.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');
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
        // Convert SchemaNode[] back to WizardTaskTreeNode[]
        const convertToWizardNodes = (nodes: any[]): WizardTaskTreeNode[] => {
          return nodes.map((node, index) => ({
            id: node.id || `node_${Date.now()}_${index}`,
            templateId: node.id || `template_${Date.now()}_${index}`,
            label: node.label,
            type: node.type,
            emoji: node.icon,
            subNodes: (node.subData || node.subTasks || []).length > 0
              ? convertToWizardNodes(node.subData || node.subTasks || [])
              : undefined
          }));
        };

        const newDataSchema = convertToWizardNodes(result.structure);
        console.log('[handleCorrectionSubmit] ✅ STEP 8: Structure converted back', {
          newDataSchemaLength: newDataSchema.length,
          firstNodeLabel: newDataSchema[0]?.label
        });

        console.log('[handleCorrectionSubmit] 📝 STEP 9: Updating dataSchema...');
        // ✅ STEP 6: Aggiorna dataSchema (mostra nuova struttura nella sidebar)
        wizardState.setDataSchema(newDataSchema);
        console.log('[handleCorrectionSubmit] ✅ STEP 9: dataSchema updated');

        console.log('[handleCorrectionSubmit] 📝 STEP 10: Updating step message...');
        // ✅ STEP 7: Aggiorna step a 'running' con messaggio "Confermami..." (come in WizardOrchestrator.start())
        wizardState.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
        console.log('[handleCorrectionSubmit] ✅ STEP 10: Step message updated');
        console.log('[handleCorrectionSubmit] ✅✅✅ REGENERATION COMPLETED SUCCESSFULLY ✅✅✅');
      } else {
        console.error('[handleCorrectionSubmit] ❌ Regeneration failed:', result.error);
        wizardState.updatePipelineStep('structure', 'failed', result.error || 'Errore durante la rigenerazione');
      }
    } catch (error) {
      console.error('[handleCorrectionSubmit] ❌❌❌ ERROR:', error);
      console.error('[handleCorrectionSubmit] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      wizardState.updatePipelineStep('structure', 'failed', error instanceof Error ? error.message : 'Errore sconosciuto');
    }
    console.log('═══════════════════════════════════════════════════════════════════════════');
  }, [
    taskLabel,
    wizardState.correctionInput,
    wizardState.dataSchema,
    wizardState.setDataSchema,
    wizardState.setCorrectionInput,
    wizardState.setStructureConfirmed,
    wizardState.updatePipelineStep,
    wizardFlow
  ]);

  // ✅ FIX: Memoize callback functions to prevent re-renders
  const onProceedFromEuristica = useCallback(async () => {
    if (taskLabel) {
      hasStartedRef.current = false;
      wizardFlow.resetToStart();
      wizardState.setCurrentStep('generazione_struttura');
      await wizardGeneration.runGenerationPipeline(taskLabel.trim(), rowId);
      await wizardSync.syncVariables();
    }
  }, [taskLabel, rowId, wizardFlow, wizardState.setCurrentStep, wizardGeneration, wizardSync]);

  const onShowModuleList = useCallback(() => {
    wizardState.setWizardMode(WizardMode.LISTA_MODULI);
    wizardState.setCurrentStep('lista_moduli');
  }, [wizardState.setWizardMode, wizardState.setCurrentStep]);

  const onSelectModule = useCallback(async (moduleId: string) => {
    if (taskLabel) {
      wizardState.setSelectedModuleId(moduleId);
      hasStartedRef.current = false;
      wizardFlow.resetToStart();
      wizardState.setCurrentStep('generazione_struttura');
      await wizardGeneration.runGenerationPipeline(taskLabel.trim(), rowId);
      await wizardSync.syncVariables();
    }
  }, [taskLabel, rowId, wizardState.setSelectedModuleId, wizardFlow, wizardState.setCurrentStep, wizardGeneration, wizardSync]);

  // ============================================
  // RETURN - API unificata per ResponseEditorLayout
  // ============================================

  // ✅ FIX: Memoize return object to prevent reference changes on every render
  return useMemo(() => ({
    // Stato wizard
    wizardMode: wizardState.wizardMode, // ✅ Questo è il vecchio hook useWizardState, manterremo per backward compatibility
    currentStep: wizardState.currentStep,
    pipelineSteps: wizardState.pipelineSteps,
    dataSchema: wizardState.dataSchema,

    // Stato conferma struttura (derivato da wizardMode)
    showStructureConfirmation: wizardState.showStructureConfirmation,
    structureConfirmed: wizardState.structureConfirmed,
    showCorrectionMode: wizardState.showCorrectionMode,
    correctionInput: wizardState.correctionInput,
    setCorrectionInput: wizardState.setCorrectionInput,

    // Handlers
    handleStructureConfirm,
    handleStructureReject,
    runGenerationPipeline: wizardOrchestrator.runGenerationPipeline,

    // Altri dati wizard
    messages: wizardState.messages,
    messagesGeneralized: wizardState.messagesGeneralized,
    messagesContextualized: wizardState.messagesContextualized,
    shouldBeGeneral: wizardState.shouldBeGeneral,
    generalizedLabel: wizardState.dataSchema?.[0]?.generalizedLabel || null,
    generalizationReason: wizardState.dataSchema?.[0]?.generalizationReason || null,
    generalizedMessages: wizardState.dataSchema?.[0]?.generalizedMessages || null,
    constraints: wizardState.constraints,
    nlpContract: wizardState.nlpContract,

    // Sotto-stati per parte variabile dinamica
    currentParserSubstep: wizardState.currentParserSubstep,
    currentMessageSubstep: wizardState.currentMessageSubstep,

    // Altri metodi wizard (per estendere wizardProps)
    onProceedFromEuristica,
    onShowModuleList,
    onSelectModule,
    onPreviewModule: wizardState.setActiveNodeId,
    availableModules: EMPTY_MODULES,
    foundModuleId: wizardState.selectedModuleId,

    // ✅ NEW: Handler per correzione struttura
    handleCorrectionSubmit,
  }), [
    // State values
    wizardState.wizardMode,
    wizardState.currentStep,
    wizardState.pipelineSteps,
    wizardState.dataSchema,
    wizardState.showStructureConfirmation,
    wizardState.structureConfirmed,
    wizardState.showCorrectionMode,
    wizardState.correctionInput,
    wizardState.setCorrectionInput,
    wizardState.messages,
    wizardState.messagesGeneralized,
    wizardState.messagesContextualized,
    wizardState.shouldBeGeneral,
    wizardState.constraints,
    wizardState.nlpContract,
    wizardState.currentParserSubstep,
    wizardState.currentMessageSubstep,
    wizardState.setActiveNodeId,
    wizardState.selectedModuleId,
    // Handlers
    handleStructureConfirm,
    handleStructureReject,
    wizardOrchestrator.runGenerationPipeline,
    // Callbacks
    onProceedFromEuristica,
    onShowModuleList,
    onSelectModule,
    // Handlers
    handleCorrectionSubmit,
  ]);
}
