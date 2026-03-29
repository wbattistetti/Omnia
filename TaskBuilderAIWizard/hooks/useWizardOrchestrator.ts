// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Hook wrapper for WizardOrchestrator
 *
 * Provides a stable React interface over WizardOrchestrator.
 * The orchestrator instance is created once and only recreated when
 * the task identity changes (rowId, templateId, projectId).
 */

import { useRef, useCallback, useMemo } from 'react';
import { WizardOrchestrator } from '../core/WizardOrchestrator';
import type { WizardTaskTreeNode } from '../types';
import type { TaskTree } from '@types/taskTypes';

export interface UseWizardOrchestratorProps {
  taskLabel?: string;
  rowId?: string;
  projectId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  replaceSelectedTaskTree?: (taskTree: TaskTree) => void;
  addTranslation?: (guid: string, text: string) => void;
  templateId?: string;
}

/**
 * Returns a stable WizardOrchestrator instance.
 * The instance is recreated only when the task identity changes
 * (rowId, templateId, projectId). All other prop changes (e.g. taskLabel edits)
 * do NOT recreate the orchestrator, preserving internal pipeline state.
 */
export function useWizardOrchestrator(props: UseWizardOrchestratorProps) {
  const orchestratorRef = useRef<WizardOrchestrator | null>(null);
  const replaceRef = useRef(props.replaceSelectedTaskTree);
  replaceRef.current = props.replaceSelectedTaskTree;

  // Track the key used to create the current orchestrator.
  // Re-create only when the task identity actually changes.
  const creationKeyRef = useRef<string>('');
  const identityKey = `${props.rowId ?? ''}|${props.templateId ?? ''}|${props.projectId ?? ''}`;
  const hasIdentity = !!(props.taskLabel || props.templateId);

  if (hasIdentity && identityKey !== creationKeyRef.current) {
    creationKeyRef.current = identityKey;
    orchestratorRef.current = new WizardOrchestrator({
      taskLabel: props.taskLabel || '',
      rowId: props.rowId,
      projectId: props.projectId,
      locale: props.locale || 'it',
      onTaskBuilderComplete: props.onTaskBuilderComplete,
      replaceSelectedTaskTree: (tt) => {
        replaceRef.current?.(tt);
      },
      addTranslation: props.addTranslation,
      templateId: props.templateId,
    });
  }

  // ─── Stable callbacks ─────────────────────────────────────────────────────

  /** @deprecated Use startFull() instead */
  const runGenerationPipeline = useCallback(async (_taskLabel: string, _rowId?: string) => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialised.');
    }
    await orchestratorRef.current.start();
  }, []);

  const continueAfterStructureConfirmation = useCallback(async (_dataSchema: WizardTaskTreeNode[]) => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialised.');
    }
    await orchestratorRef.current.confirmStructure();
  }, []);

  const startFull = useCallback(async () => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialised.');
    }
    await orchestratorRef.current.startFull();
  }, []);

  const startAdaptation = useCallback(async (templateId: string) => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialised.');
    }
    await orchestratorRef.current.startAdaptation(templateId);
  }, []);

  /** @deprecated Use startAdaptation() instead */
  const startAdaptationMode = useCallback(async (templateId: string) => {
    return startAdaptation(templateId);
  }, [startAdaptation]);

  const confirmStructure = useCallback(async () => {
    if (!orchestratorRef.current) {
      throw new Error('[useWizardOrchestrator] Orchestrator not initialised.');
    }
    await orchestratorRef.current.confirmStructure();
  }, []);

  /** @deprecated Use confirmStructure() instead */
  const confirmStructureForAdaptation = useCallback(async () => {
    return confirmStructure();
  }, [confirmStructure]);

  // Memoize the return object so its reference is stable across renders.
  return useMemo(() => ({
    runGenerationPipeline,
    continueAfterStructureConfirmation,
    confirmStructure,
    startFull,
    startAdaptation,
    startAdaptationMode,
    confirmStructureForAdaptation,
    orchestratorRef,
  }), [
    runGenerationPipeline,
    continueAfterStructureConfirmation,
    confirmStructure,
    startFull,
    startAdaptation,
    startAdaptationMode,
    confirmStructureForAdaptation,
  ]);
}
