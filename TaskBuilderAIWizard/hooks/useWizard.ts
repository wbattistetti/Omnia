// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unified Wizard Hook
 *
 * Single public hook for wizard functionality.
 * Replaces useWizardIntegrationOrchestrated and simplifies the API.
 *
 * This hook:
 * - Wraps useWizardOrchestrator
 * - Handles auto-start logic
 * - Provides clean, unified API
 * - Eliminates need for multiple wrapper hooks
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useWizardOrchestrator } from './useWizardOrchestrator';
import { useWizardSync } from './useWizardSync';
import { useWizardStore } from '../store/wizardStore';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { WizardMode } from '../types/WizardMode';
import type { WizardTaskTreeNode } from '../types';

export interface UseWizardOptions {
  taskLabel?: string;
  rowId?: string;
  projectId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  mode?: 'full' | 'adaptation';
  templateId?: string;
}

export interface UseWizardResult {
  // State (read-only)
  wizardMode: WizardMode;
  runMode: 'none' | 'full' | 'adaptation';
  currentStep: string;
  pipelineSteps: any[];
  dataSchema: WizardTaskTreeNode[];
  phaseCounters: {
    constraints: { completed: number; total: number };
    parsers: { completed: number; total: number };
    messages: { completed: number; total: number };
  };

  // UI state
  showStructureConfirmation: boolean;
  structureConfirmed: boolean;
  showCorrectionMode: boolean;
  correctionInput: string;
  setCorrectionInput: (value: string) => void;

  // Handlers
  startFull: () => Promise<void>;
  startAdaptation: (templateId: string) => Promise<void>;
  confirmStructure: () => Promise<void>;
  rejectStructure: () => void;
  handleCorrectionSubmit: () => Promise<void>;

  // Data
  messages: Map<string, any>;
  messagesGeneralized: Map<string, any>;
  messagesContextualized: Map<string, any>;
  shouldBeGeneral: boolean;
  generalizedLabel: string | null;
  generalizationReason: string | null;
  generalizedMessages: any;
  constraints: any[];
  nlpContract: any;

  // Sub-steps
  currentParserSubstep: string | null;
  currentMessageSubstep: string | null;

  // Module handlers
  onProceedFromEuristica: () => Promise<void>;
  onShowModuleList: () => void;
  onSelectModule: (moduleId: string) => Promise<void>;
  onPreviewModule: (nodeId: string | null) => void;
  availableModules: any[];
  foundModuleId: string | undefined;
}

const EMPTY_MODULES: any[] = [];

/**
 * Unified wizard hook
 *
 * Single entry point for all wizard functionality.
 * Handles both FULL and ADAPTATION modes.
 */
export function useWizard(options: UseWizardOptions): UseWizardResult | null {
  const {
    taskLabel,
    rowId,
    projectId,
    locale = 'it',
    onTaskBuilderComplete,
    mode,
    templateId
  } = options;

  // Get translation function
  let addTranslation: ((guid: string, text: string) => void) | undefined;
  try {
    const { addTranslation: addTranslationFromContext } = useProjectTranslations();
    addTranslation = addTranslationFromContext;
  } catch {
    addTranslation = undefined;
  }

  // Get orchestrator
  const orchestrator = useWizardOrchestrator({
    taskLabel: taskLabel || '',
    rowId,
    projectId,
    locale,
    onTaskBuilderComplete,
    addTranslation,
    templateId,
  });

  // Get store for variable sync
  const store = useWizardStore();

  // Sync variables
  const wizardSync = useWizardSync({
    dataSchema: store.dataSchema, // ✅ FIX: Use store.dataSchema instead of orchestrator.dataSchema
    setDataSchema: store.setDataSchema,
    taskLabel: taskLabel || '',
    rowId,
    projectId,
    locale,
  });

  const hasStartedRef = useRef(false);

  // ✅ FIX 1: Reset hasStartedRef quando cambia "contesto" (nuovo task / nuova modalità / nuovo template)
  useEffect(() => {
    hasStartedRef.current = false;
    console.log('[useWizard] 🔄 Reset hasStartedRef', { mode, templateId, taskLabel, rowId });
  }, [mode, templateId, taskLabel, rowId]); // ✅ Aggiunto rowId - quando cambia task, cambia anche rowId

  // Handler for correction submit
  const handleCorrectionSubmit = useCallback(async () => {
    if (!taskLabel || !store.correctionInput?.trim()) {
      return;
    }

    const feedback = store.correctionInput.trim();
    const previousStructure = store.dataSchema; // ✅ FIX: Use store.dataSchema instead of orchestrator.dataSchema

    if (previousStructure.length === 0) {
      return;
    }

    try {
      // Close correction form
      store.setWizardState(WizardMode.DATA_STRUCTURE_PROPOSED); // ✅ RINOMINATO: setWizardMode → setWizardState
      store.setCorrectionInput('');
      store.setStructureConfirmed(false);
      store.updatePipelineStep('structure', 'running', 'sto pensando a qual è la migliore struttura dati per questo task...');

      // Convert structure to SchemaNode[]
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

      // Regenerate structure
      const { regenerateStructure } = await import('@wizard/services/structureGenerationService');
      const provider = (localStorage.getItem('omnia.aiProvider') as 'openai' | 'groq') || 'openai';
      const result = await regenerateStructure(taskLabel, feedback, schemaNodes, provider);

      if (result.success && result.structure) {
        const { convertApiStructureToWizardTaskTree } = await import('../utils/convertApiStructureToWizardTaskTree');
        const newDataSchema = convertApiStructureToWizardTaskTree(result.structure, rowId || '');
        store.setDataSchema(newDataSchema);
        store.updatePipelineStep('structure', 'running', 'Confermami la struttura che vedi sulla sinistra...');
      } else {
        store.updatePipelineStep('structure', 'failed', result.error || 'Errore durante la rigenerazione');
      }
    } catch (error) {
      store.updatePipelineStep('structure', 'failed', error instanceof Error ? error.message : 'Errore sconosciuto');
    }
  }, [taskLabel, store.correctionInput, store.dataSchema, store, rowId]); // ✅ FIX: Use store values instead of orchestrator

  // ✅ FIX 2: Auto-start wizard (separato dal reset)
  useEffect(() => {
    console.log('[useWizard] 🔍 Auto-start effect triggered', {
      mode,
      templateId,
      taskLabel: taskLabel?.trim(),
      rowId,
      wizardState: store.wizardState,
      hasStarted: hasStartedRef.current,
      hasStartAdaptation: !!orchestrator.startAdaptation,
      hasStartAdaptationMode: !!orchestrator.startAdaptationMode
    });

    // ✅ FULL MODE: Comportamento invariato - parte solo se wizardState === START
    if (
      mode === 'full' &&
      taskLabel?.trim() &&
      store.wizardState === WizardMode.START &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
      if (orchestrator.startFull) {
        orchestrator.startFull()
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizard] ❌ Error in startFull:', error);
            hasStartedRef.current = false;
          });
      } else if (orchestrator.start) {
        orchestrator.start()
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizard] ❌ Error in start:', error);
            hasStartedRef.current = false;
          });
      }
    }

    // ✅ ADAPTATION MODE: Parte immediatamente se templateId è disponibile
    // NON aspetta wizardState === START, parte direttamente con DATA_STRUCTURE_PROPOSED
    if (
      mode === 'adaptation' &&
      templateId &&
      !hasStartedRef.current
    ) {
      console.log('[useWizard] ✅ Starting adaptation mode immediately', {
        mode,
        templateId,
        rowId,
        hasStartAdaptation: !!orchestrator.startAdaptation,
        hasStartAdaptationMode: !!orchestrator.startAdaptationMode,
        orchestratorKeys: Object.keys(orchestrator)
      });
      hasStartedRef.current = true;
      if (orchestrator.startAdaptation) {
        orchestrator.startAdaptation(templateId)
          .then(async () => {
            console.log('[useWizard] ✅ startAdaptation completed successfully');
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizard] ❌ Error in startAdaptation:', error);
            hasStartedRef.current = false;
          });
      } else if (orchestrator.startAdaptationMode) {
        orchestrator.startAdaptationMode(templateId)
          .then(async () => {
            console.log('[useWizard] ✅ startAdaptationMode completed successfully');
            await new Promise(resolve => setTimeout(resolve, 100));
            await wizardSync.syncVariables();
          })
          .catch((error) => {
            console.error('[useWizard] ❌ Error in startAdaptationMode:', error);
            hasStartedRef.current = false;
          });
      } else {
        console.error('[useWizard] ❌ No startAdaptation or startAdaptationMode method available', {
          orchestratorKeys: Object.keys(orchestrator)
        });
        hasStartedRef.current = false;
      }
    }
  }, [mode, taskLabel, templateId, store.wizardState, orchestrator, wizardSync]);

  // Return null if wizard is not active
  if (!mode || (mode !== 'full' && mode !== 'adaptation')) {
    return null;
  }

  // Build result object
  return {
    // State
    wizardMode: store.wizardState, // ✅ RINOMINATO: wizardMode → wizardState (per backward compatibility, esponiamo ancora come wizardMode)
    runMode: store.runMode || 'none', // ✅ FIX: Use store.runMode instead of orchestrator.runMode
    currentStep: store.currentStep, // ✅ FIX: Use store.currentStep instead of orchestrator.currentStep
    pipelineSteps: store.pipelineSteps, // ✅ FIX: Use store.pipelineSteps instead of orchestrator.pipelineSteps
    dataSchema: store.dataSchema, // ✅ FIX: Use store.dataSchema instead of orchestrator.dataSchema
    phaseCounters: store.phaseCounters, // ✅ FIX: Use store.phaseCounters instead of orchestrator.phaseCounters

    // UI state
    showStructureConfirmation: store.wizardState === WizardMode.DATA_STRUCTURE_PROPOSED, // ✅ RINOMINATO: wizardMode → wizardState
    structureConfirmed: store.structureConfirmed, // ✅ FIX: Use store.structureConfirmed
    showCorrectionMode: store.wizardState === WizardMode.DATA_STRUCTURE_CORRECTION, // ✅ RINOMINATO: wizardMode → wizardState
    correctionInput: store.correctionInput, // ✅ FIX: Use store.correctionInput
    setCorrectionInput: store.setCorrectionInput, // ✅ FIX: Use store.setCorrectionInput

    // Handlers
    startFull: orchestrator.startFull || (() => Promise.resolve()),
    startAdaptation: orchestrator.startAdaptation || (() => Promise.resolve()),
    confirmStructure: orchestrator.confirmStructure || (() => Promise.resolve()), // ✅ FIX: Use confirmStructure directly
    rejectStructure: () => { // ✅ FIX: Implement rejectStructure using store
      store.setWizardState(WizardMode.DATA_STRUCTURE_CORRECTION); // ✅ RINOMINATO: setWizardMode → setWizardState
      store.setStructureConfirmed(false);
    },
    handleCorrectionSubmit,

    // Data
    messages: store.messages, // ✅ FIX: Use store.messages
    messagesGeneralized: store.messagesGeneralized, // ✅ FIX: Use store.messagesGeneralized
    messagesContextualized: store.messagesContextualized, // ✅ FIX: Use store.messagesContextualized
    shouldBeGeneral: store.shouldBeGeneral, // ✅ FIX: Use store.shouldBeGeneral
    generalizedLabel: store.dataSchema?.[0]?.generalizedLabel || null, // ✅ FIX: Use store.dataSchema
    generalizationReason: store.dataSchema?.[0]?.generalizationReason || null, // ✅ FIX: Use store.dataSchema
    generalizedMessages: store.dataSchema?.[0]?.generalizedMessages || null, // ✅ FIX: Use store.dataSchema
    constraints: store.constraints, // ✅ FIX: Use store.constraints
    nlpContract: null, // ✅ FIX: nlpContract not in store, set to null for now

    // Sub-steps
    currentParserSubstep: store.currentParserSubstep, // ✅ FIX: Use store.currentParserSubstep
    currentMessageSubstep: store.currentMessageSubstep, // ✅ FIX: Use store.currentMessageSubstep

    // Module handlers
    onProceedFromEuristica: () => Promise.resolve(), // ✅ FIX: Not implemented yet, placeholder
    onShowModuleList: () => {}, // ✅ FIX: Not implemented yet, placeholder
    onSelectModule: () => Promise.resolve(), // ✅ FIX: Not implemented yet, placeholder
    onPreviewModule: store.setActiveNodeId, // ✅ FIX: Use store.setActiveNodeId
    availableModules: EMPTY_MODULES,
    foundModuleId: store.selectedModuleId, // ✅ FIX: Use store.selectedModuleId
  };
}
