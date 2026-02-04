/**
 * ResponseEditorContent
 *
 * Component that handles conditional rendering of different content states:
 * - Loading states (isInferring)
 * - Wizards (ContractWizard, DDTWizard)
 * - Intent messages builder
 * - Normal editor layout
 *
 * Extracted from index.tsx to improve maintainability and separation of concerns.
 */

import React from 'react';
import TaskTreeWizard from '../../../TaskTreeBuilder/TaskTreeWizard/DDTWizard';
import ContractWizard from '../ContractWizard/ContractWizard';
import IntentMessagesBuilder from './IntentMessagesBuilder';
import type { Task, TaskTree } from '../../../../types/taskTypes';

export interface ResponseEditorContentProps {
  // State flags
  isInferring: boolean;
  showContractWizard: boolean;
  showWizard: boolean;
  shouldShowInferenceLoading: boolean;
  needsIntentMessages: boolean;

  // Data
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>;

  // Wizard handlers
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;
  handleDDTWizardCancel: () => void;
  handleDDTWizardComplete: (finalDDT: TaskTree, messages?: any) => Promise<void>;
  getInitialTaskTree: () => TaskTree | undefined;

  // Intent messages handler
  onIntentMessagesComplete: (messages: any) => void;

  // Normal editor layout (rendered when none of the above conditions are true)
  normalEditorLayout: React.ReactNode;
}

/**
 * Component that conditionally renders different content states
 */
export function ResponseEditorContent({
  isInferring,
  showContractWizard,
  showWizard,
  shouldShowInferenceLoading,
  needsIntentMessages,
  task,
  taskTree,
  taskTreeRef,
  handleContractWizardClose,
  handleContractWizardNodeUpdate,
  handleContractWizardComplete,
  handleDDTWizardCancel,
  handleDDTWizardComplete,
  getInitialTaskTree,
  onIntentMessagesComplete,
  normalEditorLayout,
}: ResponseEditorContentProps) {
  // Loading state
  if (isInferring) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔍 Sto cercando se ho già un modello per il tipo di dato che ti serve.</div>
          <div style={{ fontSize: '14px', color: '#94a3b8' }}>Un attimo solo...</div>
        </div>
      </div>
    );
  }

  // Contract Wizard
  if (showContractWizard) {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <ContractWizard
          taskTree={taskTreeRef.current}
          integrated={true}
          onClose={handleContractWizardClose}
          onNodeUpdate={handleContractWizardNodeUpdate}
          onComplete={handleContractWizardComplete}
        />
      </div>
    );
  }

  // DDT Wizard
  if (showWizard) {
    // Show loading if inference is still in progress
    if (shouldShowInferenceLoading) {
      return (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e2e8f0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '18px', marginBottom: '16px' }}>🔍 Sto cercando se ho già un modello per il tipo di dato che ti serve.</div>
            <div style={{ fontSize: '14px', color: '#94a3b8' }}>Un attimo solo...</div>
          </div>
        </div>
      );
    }

    // Show DDT Wizard
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <TaskTreeWizard
          taskType={task?.type ? String(task.type) : undefined}
          taskLabel={task?.label || ''}
          initialTaskTree={getInitialTaskTree()}
          onCancel={handleDDTWizardCancel}
          onComplete={handleDDTWizardComplete}
          startOnStructure={false}
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
