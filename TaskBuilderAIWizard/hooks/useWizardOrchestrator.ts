// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Hook wrapper for WizardOrchestrator
 *
 * Provides the same API as the old useWizardGeneration hook,
 * but uses the new WizardOrchestrator internally.
 */

import { useRef, useCallback } from 'react';
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
}

export function useWizardOrchestrator(props: UseWizardOrchestratorProps) {
  const orchestratorRef = useRef<WizardOrchestrator | null>(null);
  const store = useWizardStore();

  // Create orchestrator instance
  if (!orchestratorRef.current && props.taskLabel) {
    orchestratorRef.current = new WizardOrchestrator({
      taskLabel: props.taskLabel,
      rowId: props.rowId,
      projectId: props.projectId,
      locale: props.locale || 'it',
      onTaskBuilderComplete: props.onTaskBuilderComplete,
      addTranslation: props.addTranslation,
    });
  }

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

  return {
    runGenerationPipeline,
    continueAfterStructureConfirmation,
  };
}
