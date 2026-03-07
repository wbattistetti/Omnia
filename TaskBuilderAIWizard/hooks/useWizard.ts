// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Unified Wizard Hook
 *
 * Single entry point for wizard functionality.
 * Consolidates useWizardOrchestrator and useWizardSync to eliminate duplication.
 *
 * ✅ REFACTOR: This hook replaces the need for multiple wizard hooks.
 * Use this as the primary hook for wizard functionality.
 */

import { useWizardOrchestrator } from '../core/WizardOrchestrator';
import { useWizardSync } from './useWizardSync';
import type { WizardTaskTreeNode } from '../types';

export interface UseWizardProps {
  taskLabel?: string;
  rowId?: string;
  projectId?: string;
  locale?: string;
  onTaskBuilderComplete?: (taskTree: any) => void;
  addTranslation?: (guid: string, text: string) => void;
}

/**
 * Unified wizard hook that combines orchestrator and sync functionality
 *
 * @param props - Wizard configuration
 * @returns Complete wizard state and handlers
 */
export function useWizard(props: UseWizardProps) {
  // ✅ Use orchestrator as primary source of truth
  const orchestrator = useWizardOrchestrator({
    taskLabel: props.taskLabel || '',
    rowId: props.rowId,
    projectId: props.projectId,
    locale: props.locale || 'it',
    onTaskBuilderComplete: props.onTaskBuilderComplete,
    addTranslation: props.addTranslation,
  });

  // ✅ Use sync for variable synchronization
  const sync = useWizardSync({
    dataSchema: orchestrator.dataSchema,
    setDataSchema: orchestrator.dataSchema, // Will be set via store
    taskLabel: props.taskLabel || '',
    rowId: props.rowId,
    projectId: props.projectId,
    locale: props.locale || 'it',
  });

  return {
    // ✅ State from orchestrator (single source of truth)
    ...orchestrator,

    // ✅ Sync functionality
    syncVariables: sync.syncVariables,
  };
}
