// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React from 'react';
import { CenterPanel } from '../../../../TaskBuilderAIWizard/components/CenterPanel';
import { convertFakeTaskTreeToTaskTree } from '../../../TaskTreeBuilder/TaskBuilderAIWizardAdapter';
import type { TaskTree } from '@types/taskTypes';
import { FakeTaskTreeNode, FakeStepMessages } from '../../../../TaskBuilderAIWizard/types';
import { PipelineStep } from '../../../../TaskBuilderAIWizard/hooks/useWizardState';
import { WizardStep } from '../../../../TaskBuilderAIWizard/types';

export interface TaskBuilderWizardPanelProps {
  taskLabel: string;
  onComplete: (taskTree: TaskTree, messages?: any) => void;
  onCancel?: () => void;
}

/**
 * Panel that integrates TaskBuilderAIWizard in ResponseEditor
 * Shown when heuristic did not find a candidate
 */
export function TaskBuilderWizardPanel({
  taskLabel,
  onComplete,
  onCancel,
}: TaskBuilderWizardPanelProps) {
  // TODO: Integrate with wizard state hooks
  // For now, this is a placeholder that will be fully implemented in Phase 15
  const handleWizardComplete = (fakeTree: FakeTaskTreeNode[], messages?: FakeStepMessages) => {
    // Convert FakeTaskTreeNode[] to TaskTree
    const taskTree = convertFakeTaskTreeToTaskTree(
      fakeTree,
      generateLabelKey(taskLabel),
      messages
    );
    onComplete(taskTree, messages);
  };

  // Placeholder state - will be replaced with real wizard state in Phase 15
  const placeholderPipelineSteps: PipelineStep[] = [
    { id: 'structure', label: 'Struttura dati', status: 'pending' },
    { id: 'constraints', label: 'Vincoli', status: 'pending' },
    { id: 'parsers', label: 'Parser', status: 'pending' },
    { id: 'messages', label: 'Messaggi', status: 'pending' },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
      }}
    >
      {/* TODO: Full integration in Phase 15 */}
      <div style={{ padding: '24px', color: '#e2e8f0' }}>
        <p>TaskBuilderWizardPanel - Placeholder</p>
        <p>Task Label: {taskLabel}</p>
        <p>Full integration will be completed in Phase 15</p>
      </div>
    </div>
  );
}

function generateLabelKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
