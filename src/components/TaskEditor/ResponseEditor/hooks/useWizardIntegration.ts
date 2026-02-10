// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useEffect, useCallback, useRef } from 'react';
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
  taskId?: string,
  rowId?: string,
  projectId?: string,
  locale: string = 'it',
  onTaskBuilderComplete?: (taskTree: any) => void
) {
  // ============================================
  // HOOK COMPOSITION
  // ============================================

  const wizardState = useWizardState();
  const wizardFlow = useWizardFlow(wizardState.wizardMode, wizardState.setWizardMode);

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
  });

  const wizardSync = useWizardSync({
    dataSchema: wizardState.dataSchema,
    setDataSchema: wizardState.setDataSchema,
    taskLabel: taskLabel || '',
    taskId,
    rowId,
    projectId,
    locale,
  });

  const wizardCompletion = useWizardCompletion({
    wizardMode: wizardState.wizardMode,
    dataSchema: wizardState.dataSchema,
    messages: wizardState.messages,
    messagesGeneralized: wizardState.messagesGeneralized,
    messagesContextualized: wizardState.messagesContextualized,
    shouldBeGeneral: wizardState.shouldBeGeneral,
    taskLabel,
    taskId,
    projectId,
    transitionToCompleted: wizardFlow.transitionToCompleted,
    onTaskBuilderComplete,
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

      wizardGeneration.runGenerationPipeline(taskLabel.trim(), taskId)
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
  }, [taskLabel, taskId, wizardState.wizardMode, wizardState.setCurrentStep, wizardGeneration, wizardSync]);

  // Monitora completamento step per auto-chiusura
  useEffect(() => {
    if (wizardState.wizardMode === WizardMode.GENERATING) {
      wizardCompletion.checkAndComplete(wizardState.pipelineSteps, wizardState.wizardMode);
    }
  }, [wizardState.pipelineSteps, wizardState.wizardMode, wizardCompletion]);

  // Quando wizard completa, crea template e istanza
  useEffect(() => {
    if (wizardState.wizardMode === WizardMode.COMPLETED && wizardState.dataSchema.length > 0) {
      wizardCompletion.createTemplateAndInstance();
    }
  }, [wizardState.wizardMode, wizardState.dataSchema.length, wizardCompletion]);

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

  // ============================================
  // RETURN - API unificata per ResponseEditorLayout
  // ============================================

  return {
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
    onProceedFromEuristica: async () => {
      if (taskLabel) {
        hasStartedRef.current = false;
        wizardFlow.resetToStart();
        wizardState.setCurrentStep('generazione_struttura');
        await wizardGeneration.runGenerationPipeline(taskLabel.trim(), taskId);
        await wizardSync.syncVariables();
      }
    },
    onShowModuleList: () => {
      wizardState.setWizardMode(WizardMode.LISTA_MODULI);
      wizardState.setCurrentStep('lista_moduli');
    },
    onSelectModule: async (moduleId: string) => {
      if (taskLabel) {
        wizardState.setSelectedModuleId(moduleId);
        hasStartedRef.current = false;
        wizardFlow.resetToStart();
        wizardState.setCurrentStep('generazione_struttura');
        await wizardGeneration.runGenerationPipeline(taskLabel.trim(), taskId);
        await wizardSync.syncVariables();
      }
    },
    onPreviewModule: wizardState.setActiveNodeId,
    availableModules: EMPTY_MODULES,
    foundModuleId: wizardState.selectedModuleId,
  };
}
