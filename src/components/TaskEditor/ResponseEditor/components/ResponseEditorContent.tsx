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
// ❌ RIMOSSO: TaskBuilderWizardPanel non più usato (wizard integrato in MainContentArea)
// import { TaskBuilderWizardPanel } from './TaskBuilderWizardPanel';
import { useTaskTreeFromStore } from '@responseEditor/core/state';
import type { Task, TaskTree } from '@types/taskTypes';
import type { TaskWizardMode } from '@taskEditor/EditorHost/types';

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

  // ✅ NEW: Wizard mode (primary)
  taskWizardMode?: TaskWizardMode;
  // ✅ DEPRECATED: Backward compatibility wizard props
  needsTaskContextualization?: boolean;
  needsTaskBuilder?: boolean;
  taskLabel?: string;
  templateId?: string;
  onTaskContextualizationComplete?: (taskTree: TaskTree) => void;
  onTaskBuilderComplete?: (taskTree: TaskTree, messages?: any) => void;
  onTaskBuilderCancel?: () => void;

  // ✅ NEW: Sidebar component (for STATO 2 - adaptation mode)
  sidebar?: React.ReactNode;

  // Normal editor layout (rendered ONLY when taskWizardMode === 'none' - STATO 1)
  normalEditorLayout?: React.ReactNode;
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
  // ✅ NEW: Wizard mode (primary)
  taskWizardMode,
  // ✅ DEPRECATED: Backward compatibility wizard props
  needsTaskContextualization,
  needsTaskBuilder,
  taskLabel,
  templateId,
  onTaskContextualizationComplete,
  onTaskBuilderComplete,
  onTaskBuilderCancel,
  sidebar,
}: ResponseEditorContentProps) {
  // ✅ FASE 2.3: Use store as SINGLE source of truth
  const taskTreeFromStore = useTaskTreeFromStore();

  // ✅ ARCHITECTURE: Extract only primitive values from taskTreeFromStore to prevent reference changes
  const taskTreeId = React.useMemo(() => taskTreeFromStore?.id, [taskTreeFromStore?.id]);
  const taskTreeNodesCount = React.useMemo(() => taskTreeFromStore?.nodes?.length, [taskTreeFromStore?.nodes?.length]);

  // ✅ ARCHITECTURE: Stabilize effectiveWizardMode with useMemo
  const effectiveWizardMode = React.useMemo<TaskWizardMode>(() => {
    return taskWizardMode ||
      (needsTaskBuilder ? 'full' : needsTaskContextualization ? 'adaptation' : 'none');
  }, [taskWizardMode, needsTaskBuilder, needsTaskContextualization]);

  // ✅ LOG: Verification log for debugging (moved to useEffect to keep render pure)
  // ✅ FIX: Use only primitive dependencies to prevent loop
  const mainListLength = taskTreeFromStore?.nodes?.length || 0;
  const hasNormalEditorLayout = !!normalEditorLayout;
  const hasSidebar = !!sidebar;
  React.useEffect(() => {
    if (effectiveWizardMode === 'full') {
      console.log('[ResponseEditorContent] ✅ FULL WIZARD MODE - Rendering CenterPanel in MainContentArea', {
        taskWizardMode,
        effectiveWizardMode,
        mainListLength,
        hasNormalEditorLayout,
        hasSidebar,
      });
    }
  }, [effectiveWizardMode, taskWizardMode, mainListLength, hasNormalEditorLayout, hasSidebar]);

  // ❌ RIMOSSO: Early return per full wizard mode
  // Ora il wizard viene gestito tramite mainViewMode nel MainContentArea
  // Il normalEditorLayout viene sempre passato, anche quando taskWizardMode === 'full'

  // ✅ PRIORITY 2: Wizard modes (checked AFTER full mode)
  // ✅ STATO 2: taskWizardMode = 'adaptation' (template found, no instance)
  // Sidebar visible + wizard adattamento (genera solo messaggi)
  if (effectiveWizardMode === 'adaptation' && taskTreeFromStore && templateId) {
    return (
      <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex' }}>
        {/* Sidebar: visible (structure from template) */}
        {sidebar && (
          <div style={{ width: '320px', borderRight: '1px solid #334155', backgroundColor: '#0f172a' }}>
            {sidebar}
          </div>
        )}
        {/* Contextualization panel: generates only messages */}
        <div style={{ flex: 1 }}>
          <TaskContextualizationPanel
            taskTree={taskTreeFromStore}
            taskLabel={taskLabel || ''}
            templateId={templateId}
            onComplete={onTaskContextualizationComplete}
            onCancel={onTaskBuilderCancel}
          />
        </div>
      </div>
    );
  }

  // ✅ STATO 1: taskWizardMode = 'none' (task exists)
  // Layout classico: sidebar + editor + preview (handled by normalEditorLayout)

  // ✅ EXISTING: Contract Wizard (unchanged)
  // ✅ IMPORTANTE: Solo se NON siamo in wizard mode
  if (showContractWizard && effectiveWizardMode === 'none') {
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
  // ✅ IMPORTANTE: Solo se NON siamo in wizard mode
  if (needsIntentMessages && effectiveWizardMode === 'none') {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '16px 20px' }}>
        <IntentMessagesBuilder
          intentLabel={task?.label || taskTree?.label || 'chiedi il problema'}
          onComplete={onIntentMessagesComplete}
        />
      </div>
    );
  }

  // ✅ STATO 1: Normal editor layout (sempre, anche quando taskWizardMode === 'full')
  // ✅ NormalEditorLayout viene sempre passato, anche quando taskWizardMode === 'full'
  // Il wizard viene gestito tramite mainViewMode nel MainContentArea
  if (normalEditorLayout) {
    return (
      <div style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}>
        {normalEditorLayout}
      </div>
    );
  }

  // ✅ Fallback: Se normalEditorLayout non è passato, c'è un problema
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div>No layout available</div>
    </div>
  );

  // ✅ Fallback: Se per qualche motivo effectiveWizardMode non è 'none' ma non è neanche 'full' o 'adaptation'
  return (
    <div style={{ flex: 1, minHeight: 0, height: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div>Unexpected wizard mode: {effectiveWizardMode}</div>
    </div>
  );
}
