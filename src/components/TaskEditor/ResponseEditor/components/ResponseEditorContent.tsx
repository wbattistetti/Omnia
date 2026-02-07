/**
 * ResponseEditorContent
 *
 * Component that handles conditional rendering of different content states:
 * - ContractWizard (for NLP contracts)
 * - Intent messages builder
 * - Normal editor layout
 *
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 *
 * NOTE: TaskWizard is now external (TaskTreeWizardModal) and no longer rendered here.
 */

import React from 'react';
import ContractWizard from '../ContractWizard/ContractWizard';
import IntentMessagesBuilder from './IntentMessagesBuilder';
import { useTaskTreeFromStore } from '../core/state';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface ResponseEditorContentProps {
  // State flags
  showContractWizard: boolean;
  needsIntentMessages: boolean;

  // Data
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;

  // ContractWizard handlers
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;

  // Intent messages handler
  onIntentMessagesComplete: (messages: any) => void;

  // Normal editor layout (rendered when none of the above conditions are true)
  normalEditorLayout: React.ReactNode;
}

/**
 * Component that conditionally renders different content states
 */
export function ResponseEditorContent({
  showContractWizard,
  needsIntentMessages,
  task,
  taskTree,
  taskTreeRef,
  handleContractWizardClose,
  handleContractWizardNodeUpdate,
  handleContractWizardComplete,
  onIntentMessagesComplete,
  normalEditorLayout,
}: ResponseEditorContentProps) {
  // ✅ FASE 2.3: Use store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  // Contract Wizard
  if (showContractWizard) {
    // ✅ FASE 2.3: Usa solo store - no fallback chain
    const currentTaskTree = taskTreeFromStore;
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <ContractWizard
          taskTree={currentTaskTree}
          integrated={true}
          onClose={handleContractWizardClose}
          onNodeUpdate={handleContractWizardNodeUpdate}
          onComplete={handleContractWizardComplete}
        />
      </div>
    );
  }

  // Intent Messages Builder
  if (needsIntentMessages) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '16px 20px' }}>
        <IntentMessagesBuilder
          intentLabel={task?.label || taskTree?.label || 'chiedi il problema'}
          onComplete={onIntentMessagesComplete}
        />
      </div>
    );
  }

  // Normal editor layout
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {normalEditorLayout}
    </div>
  );
}
