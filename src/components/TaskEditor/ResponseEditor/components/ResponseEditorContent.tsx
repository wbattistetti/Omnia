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
import ContractWizard from '@responseEditor/ContractWizard/ContractWizard';
import IntentMessagesBuilder from '@responseEditor/components/IntentMessagesBuilder';
import { TaskContextualizationPanel } from './TaskContextualizationPanel';
import { TaskBuilderWizardPanel } from './TaskBuilderWizardPanel';
import { useTaskTreeFromStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';

export interface ResponseEditorContentProps {
  // State flags
  showContractWizard: boolean;
  needsIntentMessages: boolean;

  // Data
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;

  // ContractWizard handlers
  handleContractWizardClose: () => void;
  handleContractWizardNodeUpdate: (nodeId: string) => void;
  handleContractWizardComplete: (results: any) => void;

  // Intent messages handler
  onIntentMessagesComplete: (messages: any) => void;

  // ✅ NEW: Wizard props (optional, opt-in)
  needsTaskContextualization?: boolean;
  needsTaskBuilder?: boolean;
  taskLabel?: string;
  templateId?: string;
  onTaskContextualizationComplete?: (taskTree: TaskTree) => void;
  onTaskBuilderComplete?: (taskTree: TaskTree, messages?: any) => void;
  onTaskBuilderCancel?: () => void;

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
  handleContractWizardClose,
  handleContractWizardNodeUpdate,
  handleContractWizardComplete,
  onIntentMessagesComplete,
  normalEditorLayout,
  // ✅ NEW: Wizard props
  needsTaskContextualization,
  needsTaskBuilder,
  taskLabel,
  templateId,
  onTaskContextualizationComplete,
  onTaskBuilderComplete,
  onTaskBuilderCancel,
}: ResponseEditorContentProps) {
  // ✅ FASE 2.3: Use store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  // ✅ NEW: Task Contextualization (heuristic found candidate)
  // Checked BEFORE existing conditions to ensure opt-in behavior
  if (needsTaskContextualization && taskTreeFromStore && templateId) {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex' }}>
        {/* TODO: Render existing sidebar here - will be done in Phase 14 */}
        <div style={{ width: '320px', borderRight: '1px solid #334155', backgroundColor: '#0f172a' }}>
          {/* Placeholder for sidebar - will be replaced in Phase 14 */}
        </div>
        {/* Contextualization panel */}
        <div style={{ flex: 1 }}>
          <TaskContextualizationPanel
            taskTree={taskTreeFromStore}
            taskLabel={taskLabel || ''}
            templateId={templateId}
            onComplete={onTaskContextualizationComplete || (() => {})}
            onCancel={onTaskBuilderCancel}
          />
        </div>
      </div>
    );
  }

  // ✅ NEW: Task Builder (heuristic did not find candidate)
  if (needsTaskBuilder) {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <TaskBuilderWizardPanel
          taskLabel={taskLabel || ''}
          onComplete={onTaskBuilderComplete || (() => {})}
          onCancel={onTaskBuilderCancel}
        />
      </div>
    );
  }

  // ✅ EXISTING: Contract Wizard (unchanged)
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
