// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect } from 'react';
import { WizardApp } from '../../../TaskBuilderAIWizard/WizardApp';
import type { TaskTree } from '../../types/taskTypes';
import { convertWizardTaskTreeToTaskTree } from './TaskBuilderAIWizardAdapter';
import { WizardTaskTreeNode, WizardStepMessages } from '../../../TaskBuilderAIWizard/types';

export interface TaskBuilderAIWizardWrapperProps {
  onCancel: () => void;
  onComplete?: (taskTree: TaskTree, messages?: any) => void;
  initialTaskTree?: TaskTree;
  startOnStructure?: boolean;
  taskLabel?: string;
  taskType?: string;
}

export const TaskBuilderAIWizardWrapper: React.FC<TaskBuilderAIWizardWrapperProps> = ({
  onCancel,
  onComplete,
  initialTaskTree,
  startOnStructure,
  taskLabel,
  taskType,
}) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [wizardData, setWizardData] = useState<{
    taskTree: WizardTaskTreeNode[];
    messages?: WizardStepMessages;
  } | null>(null);

  useEffect(() => {
    if (wizardData && onComplete) {
      const handleComplete = async () => {
        try {
          setIsCompleting(true);
          const taskTree = convertWizardTaskTreeToTaskTree(
            wizardData.taskTree,
            taskLabel ? generateLabelKey(taskLabel) : undefined,
            wizardData.messages
          );
          await onComplete(taskTree, wizardData.messages);
        } catch (error) {
          console.error('[TaskBuilderAIWizardWrapper] Error converting task tree:', error);
          setIsCompleting(false);
        }
      };
      handleComplete();
    }
  }, [wizardData, onComplete, taskLabel]);

  const generateLabelKey = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {taskLabel && (
        <header className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800 text-white">
          <h1 className="text-lg font-semibold">Create Task: {taskLabel}</h1>
          {isCompleting && <span className="text-sm text-gray-400">Completing...</span>}
        </header>
      )}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <WizardApp
          onComplete={(tree, messages) => setWizardData({ taskTree: tree, messages })}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
};

export default TaskBuilderAIWizardWrapper;
