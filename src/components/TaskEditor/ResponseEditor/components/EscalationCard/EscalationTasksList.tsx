/**
 * Behaviour escalation adapter: reads/writes `escalation.tasks` via TaskSequenceEditor.
 */

import React from 'react';
import { updateStepEscalations } from '@responseEditor/utils/stepHelpers';
import { useResponseEditorNavigation } from '@responseEditor/context/ResponseEditorNavigationContext';
import {
  TaskSequenceEditor,
  type TaskSequenceRow,
} from '@responseEditor/taskSequence/TaskSequenceEditor';

type EscalationTasksListProps = {
  escalation: { tasks?: TaskSequenceRow[] };
  escalationIdx: number;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateEscalation: (updater: (esc: { tasks?: TaskSequenceRow[] }) => { tasks?: TaskSequenceRow[] }) => void;
  updateSelectedNode: (updater: (node: unknown) => unknown, options?: { skipAutoSave?: boolean }) => void;
  stepKey: string;
  fillAvailableHeight?: boolean;
};

export function EscalationTasksList({
  escalation,
  escalationIdx,
  color,
  translations,
  allowedActions,
  updateEscalation,
  updateSelectedNode,
  stepKey,
  fillAvailableHeight = false,
}: EscalationTasksListProps): React.ReactElement {
  const { openTasksPanel } = useResponseEditorNavigation();
  const tasks = escalation.tasks ?? [];

  const onTasksChange = React.useCallback(
    (updater: (prev: readonly TaskSequenceRow[]) => TaskSequenceRow[]) => {
      updateEscalation((esc) => ({
        ...esc,
        tasks: updater(esc.tasks ?? []),
      }));
    },
    [updateEscalation]
  );

  const onMoveTaskAcrossLists = React.useCallback(
    (
      fromEscIdx: number,
      fromTaskIdx: number,
      toEscIdx: number,
      toTaskIdx: number,
      position: 'before' | 'after'
    ) => {
      updateSelectedNode((node) => {
        return updateStepEscalations(node, stepKey, (escalations) => {
          const updated = [...escalations];

          const fromEsc = updated[fromEscIdx];
          if (!fromEsc) return escalations;

          const escTasks = [...(fromEsc.tasks ?? [])];
          const moved = escTasks[fromTaskIdx];
          if (!moved) return escalations;

          escTasks.splice(fromTaskIdx, 1);
          updated[fromEscIdx] = { ...fromEsc, tasks: escTasks };

          if (!updated[toEscIdx]) {
            updated[toEscIdx] = { tasks: [] };
          }
          const toTasks = [...(updated[toEscIdx].tasks ?? [])];
          const insertIdx = position === 'after' ? toTaskIdx + 1 : toTaskIdx;
          toTasks.splice(insertIdx, 0, moved);
          updated[toEscIdx] = { ...updated[toEscIdx], tasks: toTasks };

          return updated;
        });
      });
    },
    [updateSelectedNode, stepKey]
  );

  return (
    <TaskSequenceEditor
      tasks={tasks}
      onTasksChange={onTasksChange}
      listIndex={escalationIdx}
      color={color}
      translations={translations}
      allowedTemplateIds={allowedActions}
      fillAvailableHeight={fillAvailableHeight}
      autoOpenTasksPanel
      onAutoOpenTasksPanel={openTasksPanel}
      onMoveTaskAcrossLists={onMoveTaskAcrossLists}
      emptyIdleLabel="Nessuna azione in questa escalation ancora. La scheda Tasks si apre da sola: trascina un task qui o dal catalogo."
    />
  );
}
