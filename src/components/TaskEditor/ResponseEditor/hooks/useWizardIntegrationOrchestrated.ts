// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard Integration (Orchestrated)
 *
 * Uses WizardOrchestrator as SINGLE SOURCE OF TRUTH.
 * NO direct store access, NO side effects, NO legacy code.
 */

import { useEffect, useRef } from 'react';
import { useWizardOrchestrator } from '../../../../../TaskBuilderAIWizard/core/WizardOrchestrator';
import { useWizardSync } from '../../../../../TaskBuilderAIWizard/hooks/useWizardSync';
import { useWizardStore } from '../../../../../TaskBuilderAIWizard/store/wizardStore';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { WizardMode } from '../../../../../TaskBuilderAIWizard/types/WizardMode';

const EMPTY_MODULES: any[] = [];

export function useWizardIntegrationOrchestrated(
  taskLabel?: string,
  rowId?: string,
  projectId?: string,
  locale: string = 'it',
  onTaskBuilderComplete?: (taskTree: any) => void
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

  // ✅ Auto-start wizard when taskLabel is available
  useEffect(() => {
    if (
      taskLabel?.trim() &&
      orchestrator.wizardMode === WizardMode.START &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
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
  }, [taskLabel, orchestrator.wizardMode, orchestrator, wizardSync]);

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
    handleStructureConfirm: orchestrator.confirmStructure,
    handleStructureReject: orchestrator.rejectStructure,
    runGenerationPipeline: orchestrator.start, // For compatibility

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
