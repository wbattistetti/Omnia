// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useCallback, useRef, useMemo } from 'react';
import { useWizardState } from '../../../../../TaskBuilderAIWizard/hooks/useWizardState';
import { useWizardFlow } from '../../../../../TaskBuilderAIWizard/hooks/useWizardFlow';
import { useWizardGeneration } from '../../../../../TaskBuilderAIWizard/hooks/useWizardGeneration';
import { useWizardSync } from '../../../../../TaskBuilderAIWizard/hooks/useWizardSync';
import { useWizardCompletion } from '../../../../../TaskBuilderAIWizard/hooks/useWizardCompletion';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';
import type { WizardTaskTreeNode } from '../../../../../TaskBuilderAIWizard/types';

const EMPTY_MODULES: any[] = [];

/**
 * Hook orchestratore che compone tutti gli hook del wizard.
 * Gestisce il flusso completo: stato, transizioni, generazione, sincronizzazione, completamento.
 * Espone API unificata per ResponseEditorLayout.
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
    wizardMode: wizardState.wizardMode,
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

  // ✅ Create wizardGeneration AFTER wizardCompletion so we can pass createTemplateAndInstanceForProposed
  const wizardGeneration = useWizardGeneration({
    locale,
    dataSchema: wizardState.dataSchema,
    setDataSchema: wizardState.setDataSchema,
    setConstraints: wizardState.setConstraints,
    setNlpContract: wizardState.setNlpContract,
    setMessages: wizardState.setMessages,
    setShouldBeGeneral: wizardState.setShouldBeGeneral,
    updatePipelineStep: wizardState.updatePipelineStep,
    setPipelineSteps: wizardState.setPipelineSteps,
    updateTaskPipelineStatus: wizardState.updateTaskPipelineStatus,
    updateTaskProgress: wizardState.updateTaskProgress,
    updateParserSubstep: wizardState.setCurrentParserSubstep,
    updateMessageSubstep: wizardState.setCurrentMessageSubstep,
    transitionToProposed: wizardFlow.transitionToProposed,
    transitionToGenerating: wizardFlow.transitionToGenerating,
    // ✅ NEW: Pass createTemplateAndInstanceForProposed from wizardCompletion
    createTemplateAndInstanceForProposed: wizardCompletion.createTemplateAndInstanceForProposed,
    // ✅ MODELLO DETERMINISTICO: Pass checkAndCompleteRef
    // checkAndComplete legge direttamente da messages/messagesGeneralized (props), non serve getMessages
    checkAndCompleteRef: wizardCompletion.checkAndCompleteRef,
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

      wizardGeneration.runGenerationPipeline(taskLabel.trim(), rowId)
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
      await wizardGeneration.continueAfterStructureConfirmation(wizardState.dataSchema);
    } catch (error) {
      console.error('[useWizardIntegration][handleStructureConfirm] ❌ Error:', error);
      throw error;
    }
  }, [
    wizardState.updatePipelineStep,
    wizardState.dataSchema,
    wizardState.setPipelineSteps,
    wizardFlow,
    wizardGeneration,
  ]);

  const handleStructureReject = useCallback(() => {
    wizardFlow.transitionToCorrection();
  }, [wizardFlow]);

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
    wizardMode: wizardState.wizardMode,
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
    runGenerationPipeline: wizardGeneration.runGenerationPipeline,

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
    wizardGeneration.runGenerationPipeline,
    // Callbacks
    onProceedFromEuristica,
    onShowModuleList,
    onSelectModule,
  ]);
}
