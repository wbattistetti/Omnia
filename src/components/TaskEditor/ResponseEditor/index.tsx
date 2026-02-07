import React, { useEffect } from 'react';
import { useProjectDataUpdate } from '@context/ProjectDataContext';
import { ContractUpdateDialog } from '@responseEditor/ContractUpdateDialog';
import EditorHeader from '@components/common/EditorHeader';
import TaskDragLayer from '@responseEditor/TaskDragLayer';
import { FontProvider, useFontContext } from '@context/FontContext';
import { ToolbarButton } from '@dock/types';
import { ResponseEditorLayout } from '@responseEditor/components/ResponseEditorLayout';
import { useResponseEditor } from '@responseEditor/hooks/useResponseEditor';
import { validateTaskTreeStructure } from '@responseEditor/core/domain/validators';

import type { TaskMeta } from '@taskEditor/EditorHost/types';
import type { Task, TaskTree } from '@types/taskTypes';

function ResponseEditorInner({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  const pdUpdate = useProjectDataUpdate();
  const currentProjectId = pdUpdate?.getCurrentProjectId() || null;
  const { combinedClass } = useFontContext();

  // Validate TaskTree structure on mount/update
  useEffect(() => {
    if (taskTree) {
      try {
        validateTaskTreeStructure(taskTree, 'ResponseEditor');
      } catch (error) {
        console.error('[ResponseEditor] Invalid TaskTree structure:', error);
        // Error is logged but doesn't crash the app - allows graceful degradation
      }
    }
  }, [taskTree]);

  // ✅ FASE 3.1: Use main composite hook
  const editor = useResponseEditor({
    taskTree,
    task,
    isTaskTreeLoading,
    onWizardComplete,
    currentProjectId,
    tabId,
    setDockTree,
    onClose,
    hideHeader,
    onToolbarUpdate,
    registerOnClose,
  });

  return (
    <ResponseEditorLayout
      editor={editor}
      combinedClass={combinedClass}
      hideHeader={hideHeader}
      taskTree={taskTree}
      currentProjectId={currentProjectId}
    />
  );
}

export default function ResponseEditor({ taskTree, onClose, onWizardComplete, task, isTaskTreeLoading, hideHeader, onToolbarUpdate, tabId, setDockTree, registerOnClose }: { taskTree?: TaskTree | null, onClose?: () => void, onWizardComplete?: (finalTaskTree: TaskTree) => void, task?: TaskMeta | Task, isTaskTreeLoading?: boolean, hideHeader?: boolean, onToolbarUpdate?: (toolbar: ToolbarButton[], color: string) => void, tabId?: string, setDockTree?: (updater: (prev: any) => any) => void, registerOnClose?: (fn: () => Promise<boolean>) => void }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <FontProvider>
        <ResponseEditorInner taskTree={taskTree} onClose={onClose} onWizardComplete={onWizardComplete} task={task} isTaskTreeLoading={isTaskTreeLoading} hideHeader={hideHeader} onToolbarUpdate={onToolbarUpdate} tabId={tabId} setDockTree={setDockTree} registerOnClose={registerOnClose} />
      </FontProvider>
    </div>
  );
}