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

  // Always keep a current reference to syncVariables without it being a useEffect dep.
  // This avoids the stale-closure problem (the .then() callback always calls the latest version)
  // and removes wizardSync from the auto-start effect dependency array.
  const syncVariablesRef = useRef(wizardSync.syncVariables);
  syncVariablesRef.current = wizardSync.syncVariables;

  // Reset hasStartedRef when the context changes (new task / new mode / new template).
  // Kept separate from the auto-start effect to avoid the "reset then immediately start" race.
  useEffect(() => {
    hasStartedRef.current = false;
  }, [mode, templateId, taskLabel, rowId]);

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

  // Auto-start wizard.
  // wizardSync is intentionally NOT in the deps array — syncVariablesRef.current is used
  // instead to avoid firing this effect on every render (wizardSync object was unstable).
  useEffect(() => {
    // FULL MODE: unchanged behaviour — starts only when wizardState === START
    if (
      mode === 'full' &&
      taskLabel?.trim() &&
      store.wizardState === WizardMode.START &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
      const startFn = orchestrator.startFull ?? orchestrator.start;
      if (startFn) {
        startFn()
          .then(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            await syncVariablesRef.current();
          })
          .catch((error) => {
            console.error('[useWizard] Error in startFull:', error);
            hasStartedRef.current = false;
          });
      }
    }

    // ADAPTATION MODE: starts immediately when templateId is available.
    // Does NOT wait for wizardState === START.
    if (
      mode === 'adaptation' &&
      templateId &&
      !hasStartedRef.current
    ) {
      hasStartedRef.current = true;
      const startFn = orchestrator.startAdaptation ?? orchestrator.startAdaptationMode;
      if (startFn) {
        startFn(templateId)
          .catch((error) => {
            console.error('[useWizard] Error in startAdaptation:', error);
            hasStartedRef.current = false;
          });
        // No syncVariables here: the task does not exist yet at this point.
        // It is created inside executeAdaptationFlow (after the user confirms).
      } else {
        console.error('[useWizard] No startAdaptation method on orchestrator');
        hasStartedRef.current = false;
      }
    }
  }, [mode, taskLabel, templateId, store.wizardState, orchestrator]);

  // Wizard is only active in 'full' or 'adaptation' mode.
  if (mode !== 'full' && mode !== 'adaptation') {
    return null;
  }

  return {
    // ── State (read from store — single source of truth) ──────────────────
    wizardMode: store.wizardState,
    runMode: store.runMode || 'none',
    currentStep: store.currentStep,
    pipelineSteps: store.pipelineSteps,
    dataSchema: store.dataSchema,
    phaseCounters: store.phaseCounters,

    // ── UI state ──────────────────────────────────────────────────────────
    showStructureConfirmation: store.wizardState === WizardMode.DATA_STRUCTURE_PROPOSED,
    structureConfirmed: store.structureConfirmed,
    showCorrectionMode: store.wizardState === WizardMode.DATA_STRUCTURE_CORRECTION,
    correctionInput: store.correctionInput,
    setCorrectionInput: store.setCorrectionInput,

    // ── Handlers ──────────────────────────────────────────────────────────
    startFull: orchestrator.startFull,
    startAdaptation: orchestrator.startAdaptation,
    confirmStructure: orchestrator.confirmStructure,
    rejectStructure: () => {
      store.setWizardState(WizardMode.DATA_STRUCTURE_CORRECTION);
      store.setStructureConfirmed(false);
    },
    handleCorrectionSubmit,

    // ── Data ──────────────────────────────────────────────────────────────
    messages: store.messages,
    messagesGeneralized: store.messagesGeneralized,
    messagesContextualized: store.messagesContextualized,
    shouldBeGeneral: store.shouldBeGeneral,
    generalizedLabel: store.dataSchema?.[0]?.generalizedLabel || null,
    generalizationReason: store.dataSchema?.[0]?.generalizationReason || null,
    generalizedMessages: store.dataSchema?.[0]?.generalizedMessages || null,
    constraints: store.constraints,
    nlpContract: null,

    // ── Sub-steps ─────────────────────────────────────────────────────────
    currentParserSubstep: store.currentParserSubstep,
    currentMessageSubstep: store.currentMessageSubstep,

    // ── Module handlers (placeholders — not yet implemented) ──────────────
    onProceedFromEuristica: () => Promise.resolve(),
    onShowModuleList: () => {},
    onSelectModule: () => Promise.resolve(),
    onPreviewModule: store.setActiveNodeId,
    availableModules: EMPTY_MODULES,
    foundModuleId: store.selectedModuleId,
  };
}
