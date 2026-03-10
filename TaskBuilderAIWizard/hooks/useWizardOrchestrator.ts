// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Hook wrapper for WizardOrchestrator
 *
 * Provides the same API as the old useWizardGeneration hook,
 * but uses the new WizardOrchestrator internally.
 */

import { useRef, useCallback, useEffect } from 'react';
import { WizardOrchestrator, type WizardOrchestratorConfig } from '../core/WizardOrchestrator';
import { useWizardStore } from '../store/wizardStore';
import type { WizardTaskTreeNode } from '../types';

export interface UseWizardOrchestratorProps {
  taskLabel?: string;
  rowId?: string;
  projectId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  addTranslation?: (guid: string, text: string) => void;
  templateId?: string; // ✅ Template ID for adaptation mode
}

export function useWizardOrchestrator(props: UseWizardOrchestratorProps) {
  const orchestratorRef = useRef<WizardOrchestrator | null>(null);
  const store = useWizardStore();

  // ✅ FIX: Crea orchestrator iniziale se necessario (anche solo con templateId per adaptation mode)
  if (!orchestratorRef.current && (props.taskLabel || props.templateId)) {
    orchestratorRef.current = new WizardOrchestrator({
      taskLabel: props.taskLabel || '', // ✅ Permetti taskLabel vuoto in adaptation mode
      rowId: props.rowId,
      projectId: props.projectId,
      locale: props.locale || 'it',
      onTaskBuilderComplete: props.onTaskBuilderComplete,
      addTranslation: props.addTranslation,
      templateId: props.templateId,
    });
    console.log('[useWizardOrchestrator] ✅ Orchestrator created initially', {
      hasTaskLabel: !!props.taskLabel,
      hasTemplateId: !!props.templateId,
      rowId: props.rowId
    });
  }

  // ✅ FIX: Ricrea orchestrator solo quando cambiano rowId o templateId (nuovo task / nuovo template)
  // NON ricrearlo ad ogni cambio di taskLabel (per evitare di buttare via stato interno)
  useEffect(() => {
    // ✅ Ricrea solo se rowId o templateId cambiano (nuovo task o nuovo template)
    const shouldRecreate = props.rowId || props.templateId;
    if (shouldRecreate) {
      orchestratorRef.current = new WizardOrchestrator({
        taskLabel: props.taskLabel || '',
        rowId: props.rowId,
        projectId: props.projectId,
        locale: props.locale || 'it',
        onTaskBuilderComplete: props.onTaskBuilderComplete,
        addTranslation: props.addTranslation,
        templateId: props.templateId,
      });
      console.log('[useWizardOrchestrator] ✅ Orchestrator recreated', {
        rowId: props.rowId,
        templateId: props.templateId,
        hasStartAdaptation: !!orchestratorRef.current?.startAdaptation
      });
    }
  }, [props.rowId, props.templateId, props.projectId]); // ✅ Solo rowId, templateId, projectId - le altre props vengono aggiornate nell'orchestrator se necessario

  const runGenerationPipeline = useCallback(async (taskLabel: string, rowId?: string) => {
    if (!orchestratorRef.current) {
      orchestratorRef.current = new WizardOrchestrator({
        taskLabel,
        rowId,
        projectId: props.projectId,
        locale: props.locale || 'it',
        onTaskBuilderComplete: props.onTaskBuilderComplete,
        addTranslation: props.addTranslation,
      });
    }
    await orchestratorRef.current.start();
  }, [props.projectId, props.locale, props.onTaskBuilderComplete, props.addTranslation]);

  const continueAfterStructureConfirmation = useCallback(async (dataSchema: WizardTaskTreeNode[]) => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialized. Call runGenerationPipeline first.');
    }
    await orchestratorRef.current.confirmStructure();
  }, []);

  const startFull = useCallback(async () => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialized.');
    }
    await orchestratorRef.current.startFull();
  }, []);

  const startAdaptation = useCallback(async (templateId: string) => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialized.');
    }
    await orchestratorRef.current.startAdaptation(templateId);
  }, []);

  const startAdaptationMode = useCallback(async (templateId: string) => {
    // @deprecated - use startAdaptation instead
    return startAdaptation(templateId);
  }, [startAdaptation]);

  const confirmStructureForAdaptation = useCallback(async () => {
    // @deprecated - use confirmStructure instead (now unified)
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialized.');
    }
    await orchestratorRef.current.confirmStructure();
  }, []);

  const confirmStructure = useCallback(async () => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialized.');
    }
    await orchestratorRef.current.confirmStructure();
  }, []);

  return {
    runGenerationPipeline,
    continueAfterStructureConfirmation,
    confirmStructure, // ✅ NEW: Expose confirmStructure directly
    startFull,
    startAdaptation,
    startAdaptationMode, // @deprecated
    confirmStructureForAdaptation, // @deprecated
    orchestratorRef, // ✅ Expose ref for direct access if needed
  };
}
