/**
 * TaskTreeWizardModal
 *
 * External wizard component for creating new TaskTree.
 * This wizard is shown as a modal/overlay BEFORE opening ResponseEditor.
 *
 * Flow:
 * 1. User clicks on row → Opens this wizard (not ResponseEditor)
 * 2. Wizard completes → Closes wizard → Opens ResponseEditor with created TaskTree
 * 3. ResponseEditor shows only editing/viewing (no wizard inside)
 */

import React, { useState } from 'react';
import TaskWizard from './TaskWizard';
import type { TaskTree } from '../../../types/taskTypes';
import { TaskType } from '../../../types/taskTypes';
import { FontProvider } from '../../../context/FontContext';

export interface TaskTreeWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (taskTree: TaskTree, messages?: any) => Promise<void>;
  taskLabel?: string;
  taskType?: TaskType | string;
  initialTaskTree?: TaskTree;
  startOnStructure?: boolean;
}

/**
 * External TaskTree Wizard Modal
 *
 * This component wraps TaskTreeWizard in a modal overlay.
 * It handles the creation flow separately from ResponseEditor.
 */
export const TaskTreeWizardModal: React.FC<TaskTreeWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  taskLabel = '',
  taskType,
  initialTaskTree,
  startOnStructure = false,
}) => {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!startOnStructure ? false : true); // ✅ Inizia compatto se startOnStructure è false

  // ✅ Ascolta evento di espansione dal wizard
  React.useEffect(() => {
    const handleExpand = () => {
      setIsExpanded(true);
    };
    document.addEventListener('taskTreeWizard:expand', handleExpand);
    return () => {
      document.removeEventListener('taskTreeWizard:expand', handleExpand);
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const handleWizardComplete = async (finalTaskTree: TaskTree, messages?: any) => {
    try {
      setIsCompleting(true);
      await onComplete(finalTaskTree, messages);
      // Wizard will be closed by parent component after onComplete succeeds
    } catch (error) {
      console.error('[TaskTreeWizardModal] Error in onComplete:', error);
      setIsCompleting(false);
      // Keep wizard open on error so user can retry
    }
  };

  const handleWizardCancel = () => {
    if (!isCompleting) {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        // Close on backdrop click (but not during completion)
        if (e.target === e.currentTarget && !isCompleting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isExpanded ? '1400px' : '500px',
          height: isExpanded ? '90vh' : 'auto',
          maxHeight: isExpanded ? '900px' : '400px',
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          transition: 'all 0.3s ease-in-out', // ✅ Animazione smooth per espansione
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - nascosto in modalità compatta */}
        {isExpanded && (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#1e293b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#e2e8f0' }}>
                {taskLabel ? `Crea Task per: ${taskLabel}` : 'Crea nuovo Task'}
              </h2>
              {taskType && (
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    backgroundColor: '#334155',
                    color: '#cbd5e1',
                  }}
                >
                  {typeof taskType === 'string' ? taskType : TaskType[taskType]}
                </span>
              )}
            </div>
            <button
              onClick={handleWizardCancel}
              disabled={isCompleting}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: isCompleting ? 'not-allowed' : 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '20px',
                lineHeight: 1,
                opacity: isCompleting ? 0.5 : 1,
              }}
              title="Chiudi wizard"
            >
              ×
            </button>
          </div>
        )}

        {/* Wizard Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <FontProvider>
            <TaskWizard
              taskLabel={taskLabel}
              taskType={taskType ? String(taskType) : undefined}
              initialTaskTree={initialTaskTree}
              startOnStructure={startOnStructure}
              onCancel={handleWizardCancel}
              onComplete={handleWizardComplete}
            />
          </FontProvider>
        </div>
      </div>
    </div>
  );
};

export default TaskTreeWizardModal;
