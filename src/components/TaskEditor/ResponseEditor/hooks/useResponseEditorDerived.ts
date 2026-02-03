// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useMemo } from 'react';
import { getTaskVisualsByType } from '../../../Flowchart/utils/taskVisuals';
import { hasIntentMessages } from '../utils/hasMessages';
import type { Task, TaskTree } from '../../../../types/taskTypes';
import type { RightPanelMode } from '../RightPanel';

export interface UseResponseEditorDerivedParams {
  task: Task | null | undefined;
  taskTree: TaskTree | null | undefined;
  mainList: any[];
  leftPanelMode: RightPanelMode;
  testPanelMode: RightPanelMode;
}

export interface UseResponseEditorDerivedResult {
  needsIntentMessages: boolean;
  taskType: number;
  headerTitle: string;
  icon: any;
  iconColor: string;
  rightMode: RightPanelMode;
}

/**
 * Hook that provides derived values for ResponseEditor (needsIntentMessages, taskType, headerTitle, icon, iconColor, rightMode).
 */
export function useResponseEditorDerived(params: UseResponseEditorDerivedParams): UseResponseEditorDerivedResult {
  const {
    task,
    taskTree,
    mainList,
    leftPanelMode,
    testPanelMode,
  } = params;

  // Verifica se kind === "intent" e non ha messaggi (mostra IntentMessagesBuilder se non ci sono)
  const needsIntentMessages = useMemo(() => {
    const firstMain = mainList[0];
    const hasMessages = hasIntentMessages(taskTree, task);
    return firstMain?.kind === 'intent' && !hasMessages;
  }, [mainList, taskTree, task]);

  // CRITICAL: NO FALLBACK - type MUST be present
  const taskType = useMemo(() => {
    if (!task?.type) {
      throw new Error(`[ResponseEditor] Task is missing required field 'type'. Task: ${JSON.stringify(task, null, 2)}`);
    }
    return task.type;
  }, [task?.type]);

  // Aggiornare per usare getTaskVisuals(taskType, task?.category, task?.categoryCustom, !!taskTree)
  const { Icon, color: iconColor } = useMemo(() =>
    getTaskVisualsByType(taskType, !!taskTree),
    [taskType, taskTree]
  );

  // Priority: _sourceTask.label (preserved task info) > task.label (direct prop) > localTaskTree._userLabel (legacy) > generic fallback
  // NOTE: Do NOT use localTaskTree.label here - that's the TaskTree root label (e.g. "Age") which belongs in the TreeView, not the header
  const headerTitle = useMemo(() => {
    const sourceTask = (taskTree as any)?._sourceTask || (taskTree as any)?._sourceAct; // RINOMINATO: sourceAct → sourceTask (backward compatibility con _sourceAct)
    return sourceTask?.label || task?.label || (taskTree as any)?._userLabel || 'Response Editor';
  }, [taskTree, task?.label]);

  // Mantieni rightMode per compatibilità (combinazione di leftPanelMode e testPanelMode)
  const rightMode: RightPanelMode = useMemo(() =>
    testPanelMode === 'chat' ? 'chat' : leftPanelMode,
    [testPanelMode, leftPanelMode]
  );

  return {
    needsIntentMessages,
    taskType,
    headerTitle,
    icon: Icon,
    iconColor,
    rightMode,
  };
}
