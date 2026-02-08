// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState, useEffect } from 'react';
import { WizardApp } from '../../../../../TaskBuilderAIWizard/WizardApp';
import { convertFakeTaskTreeToTaskTree } from '../../../TaskTreeBuilder/TaskBuilderAIWizardAdapter';
import type { TaskTree } from '@types/taskTypes';
import { FakeTaskTreeNode, FakeStepMessages } from '../../../../../TaskBuilderAIWizard/types';

export interface TaskBuilderWizardPanelProps {
  taskLabel: string;
  onComplete: (taskTree: TaskTree, messages?: any) => void;
  onCancel?: () => void;
}

/**
 * Panel that integrates TaskBuilderAIWizard in ResponseEditor
 * Shown when heuristic did not find a candidate (Scenario 2B)
 */
export function TaskBuilderWizardPanel({
  taskLabel,
  onComplete,
  onCancel,
}: TaskBuilderWizardPanelProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [wizardData, setWizardData] = useState<{
    taskTree: FakeTaskTreeNode[];
    messages?: FakeStepMessages;
  } | null>(null);

  useEffect(() => {
    if (wizardData && onComplete) {
      const handleComplete = async () => {
        try {
          setIsCompleting(true);
          const taskTree = convertFakeTaskTreeToTaskTree(
            wizardData.taskTree,
            generateLabelKey(taskLabel),
            wizardData.messages
          );
          await onComplete(taskTree, wizardData.messages);
        } catch (error) {
          console.error('[TaskBuilderWizardPanel] Error converting task tree:', error);
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
    <div
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* ✅ ARCHITECTURE: WizardApp needs full height container */}
      {/* ✅ CRITICAL: Container deve occupare tutto lo spazio disponibile */}
      {/* ✅ FIX: Override h-screen from WizardApp with height: 100% for flex container */}
      {/* ✅ FIX: Use CSS to override Tailwind's h-screen class */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          width: '100%',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        className="w-full h-full"
      >
        {/* ✅ FIX: Override WizardApp's h-screen class by wrapping it */}
        {/* ✅ CRITICAL: This wrapper forces WizardApp to respect flex container height */}
        {/* ✅ FIX: Use a style tag to override Tailwind's h-screen class */}
        <style>{`
          .wizard-app-wrapper > div[class*="h-screen"] {
            height: 100% !important;
            max-height: 100% !important;
          }
        `}</style>
        <div
          className="wizard-app-wrapper"
          style={{
            width: '100%',
            height: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <WizardApp />
        </div>
      </div>
    </div>
  );
}
