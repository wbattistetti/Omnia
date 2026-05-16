/**
 * Reusable ordered task list: palette drop, row reorder, parameter editors, delete.
 * Used by escalation steps and AI Agent use case response (`response.tasks`).
 */

import React from 'react';
import TaskRowDnDWrapper from '@responseEditor/TaskRowDnDWrapper';
import TaskRow from '@responseEditor/TaskRow';
import { getTaskIconNode, getTaskLabel } from '@responseEditor/taskMeta';
import getIconComponent from '@responseEditor/icons';
import { ensureHexColor } from '@responseEditor/utils/color';
import CanvasDropWrapper from '@responseEditor/CanvasDropWrapper';
import PanelEmptyDropZone from '@responseEditor/PanelEmptyDropZone';
import { isMessageLikeEscalationTask } from '@responseEditor/utils/escalationHelpers';
import { useTaskEditing } from '@responseEditor/hooks/useTaskEditing';
import { useProjectTranslations } from '@context/ProjectTranslationsContext';
import { useBehaviourUiOptional } from '@responseEditor/behaviour/BehaviourUiContext';
import { TaskRowHeader } from '@responseEditor/tasks/TaskRowHeader';
import { TaskRowBody } from '@responseEditor/tasks/TaskRowBody';
import { ParameterFieldHost } from '@responseEditor/tasks/parameterEditors';
import { resolveTranslationKey } from '@responseEditor/utils/taskUiText';
import type { BehaviourFocusTarget } from '@responseEditor/behaviour/BehaviourUiContext';
import { useTaskSequenceFocusOptional } from './TaskSequenceFocusContext';
import {
  firstFocusParameterId,
  matchesAllowedTemplateId,
  normalizeIncomingPaletteTask,
  reorderTasksInList,
} from './taskSequenceUtils';
import { TaskSequenceAppendDropZone } from './TaskSequenceAppendDropZone';

export type TaskSequenceRow = {
  id?: string;
  type: number;
  templateId: string | null;
  parameters?: { parameterId: string; value: unknown }[];
  color?: string;
  label?: string;
  iconName?: string;
};

export type TaskSequenceEditorProps = {
  tasks: readonly TaskSequenceRow[];
  onTasksChange: (updater: (prev: readonly TaskSequenceRow[]) => TaskSequenceRow[]) => void;
  /** DnD scope id (escalation index in Behaviour; 0 for single-list use cases). */
  listIndex?: number;
  color?: string;
  translations?: Record<string, string>;
  allowedTemplateIds?: readonly string[];
  fillAvailableHeight?: boolean;
  emptyIdleLabel?: string;
  emptyOverLabel?: string;
  /**
   * When the list becomes empty, call once (e.g. open Tasks palette in ResponseEditor).
   * Ignored if `autoOpenTasksPanel` is false.
   */
  autoOpenTasksPanel?: boolean;
  onAutoOpenTasksPanel?: () => void;
  /**
   * Cross-list moves (Behaviour: task dragged to another escalation). Intra-list reorder
   * is handled internally when `fromListIndex === toListIndex === listIndex`.
   */
  onMoveTaskAcrossLists?: (
    fromListIndex: number,
    fromTaskIdx: number,
    toListIndex: number,
    toTaskIdx: number,
    position: 'before' | 'after'
  ) => void;
};

const DEFAULT_EMPTY_IDLE =
  'Nessun task ancora. Trascina un\'azione qui o dal catalogo a destra.';
const DEFAULT_EMPTY_OVER = 'Rilascia per aggiungere il task';

export function TaskSequenceEditor({
  tasks,
  onTasksChange,
  listIndex = 0,
  color = '#fb923c',
  translations: translationsProp,
  allowedTemplateIds,
  fillAvailableHeight = false,
  emptyIdleLabel = DEFAULT_EMPTY_IDLE,
  emptyOverLabel = DEFAULT_EMPTY_OVER,
  autoOpenTasksPanel = false,
  onAutoOpenTasksPanel,
  onMoveTaskAcrossLists,
}: TaskSequenceEditorProps): React.ReactElement {
  const { handleEditingChange, isEditing: isEditingRow } = useTaskEditing();
  const behaviourFocus = useBehaviourUiOptional();
  const sequenceFocus = useTaskSequenceFocusOptional();
  const focusApi = behaviourFocus ?? sequenceFocus;

  const requestFocusParameter = focusApi?.requestFocusParameter;
  const {
    translations: contextTranslations,
    addTranslation,
    isReady,
  } = useProjectTranslations();

  const effectiveTranslations = React.useMemo(
    () => ({ ...contextTranslations, ...(translationsProp ?? {}) }),
    [contextTranslations, translationsProp]
  );

  const taskList = tasks ?? [];

  const emptyPanelAutoOpenedRef = React.useRef(false);
  React.useEffect(() => {
    emptyPanelAutoOpenedRef.current = false;
  }, [listIndex]);

  React.useEffect(() => {
    if (!autoOpenTasksPanel || !onAutoOpenTasksPanel) return;
    if (!isReady) return;
    if (taskList.length > 0) {
      emptyPanelAutoOpenedRef.current = false;
      return;
    }
    if (emptyPanelAutoOpenedRef.current) return;
    emptyPanelAutoOpenedRef.current = true;
    onAutoOpenTasksPanel();
  }, [isReady, taskList.length, autoOpenTasksPanel, onAutoOpenTasksPanel, listIndex]);

  const pendingFocusRef = React.useRef<BehaviourFocusTarget | null>(null);

  React.useLayoutEffect(() => {
    if (!isReady || !requestFocusParameter) return;
    const p = pendingFocusRef.current;
    if (!p) return;
    if (p.escalationIdx !== listIndex) return;
    if (p.taskIdx < 0 || p.taskIdx >= taskList.length) return;
    requestFocusParameter(p);
    pendingFocusRef.current = null;
  }, [taskList, listIndex, requestFocusParameter, isReady]);

  const queueFocus = React.useCallback(
    (taskIdx: number, parameterId: string) => {
      pendingFocusRef.current = {
        kind: 'parameter',
        escalationIdx: listIndex,
        taskIdx,
        parameterId,
      };
    },
    [listIndex]
  );

  const handleParameterCommit = React.useCallback(
    (taskIdx: number, parameterId: string, newValue: string) => {
      const task = taskList[taskIdx];
      if (!task) return;

      const tKey = resolveTranslationKey(task, parameterId);
      if (tKey && addTranslation) {
        addTranslation(tKey, newValue);
        return;
      }

      onTasksChange((prev) => {
        const next = [...prev];
        const t = { ...next[taskIdx] };
        t.parameters = (t.parameters ?? []).map((p) =>
          p.parameterId === parameterId ? { ...p, value: newValue } : p
        );
        next[taskIdx] = t;
        return next;
      });
    },
    [taskList, addTranslation, onTasksChange]
  );

  const handleAppend = React.useCallback(
    (incoming: unknown) => {
      if (allowedTemplateIds && allowedTemplateIds.length > 0) {
        const raw = (incoming as { task?: { templateId?: string; id?: string } })?.task ?? incoming;
        const tid =
          (raw as { templateId?: string })?.templateId ?? (raw as { id?: string })?.id ?? '';
        if (!matchesAllowedTemplateId(tid, allowedTemplateIds)) {
          return;
        }
      }

      let taskRef: TaskSequenceRow;
      try {
        taskRef = normalizeIncomingPaletteTask(incoming);
      } catch (e) {
        console.error('[TaskSequenceEditor] normalizeIncomingPaletteTask failed on append', e, {
          incoming,
        });
        return;
      }

      onTasksChange((prev) => {
        const newTasks = [...prev, taskRef];
        const newTaskIdx = newTasks.length - 1;
        const pid = firstFocusParameterId(taskRef);
        if (pid) queueFocus(newTaskIdx, pid);
        return newTasks;
      });
    },
    [onTasksChange, allowedTemplateIds, queueFocus]
  );

  const handleDelete = React.useCallback(
    (taskIdx: number) => {
      onTasksChange((prev) => prev.filter((_, j) => j !== taskIdx));
    },
    [onTasksChange]
  );

  const handleDropFromViewer = React.useCallback(
    (
      incoming: unknown,
      to: { escalationIdx: number; taskIdx: number },
      position: 'before' | 'after'
    ) => {
      if (to.escalationIdx !== listIndex) return;

      if (allowedTemplateIds && allowedTemplateIds.length > 0) {
        const raw = (incoming as { task?: { templateId?: string; id?: string } })?.task ?? incoming;
        const templateId =
          (raw as { templateId?: string })?.templateId ?? (raw as { id?: string })?.id ?? null;
        if (!matchesAllowedTemplateId(templateId, allowedTemplateIds)) {
          return;
        }
      }

      let normalized: TaskSequenceRow;
      try {
        normalized = normalizeIncomingPaletteTask(incoming);
      } catch (e) {
        console.error('[TaskSequenceEditor] normalizeIncomingPaletteTask failed on drop', e, {
          incoming,
        });
        return;
      }

      const insertIdx = position === 'after' ? to.taskIdx + 1 : to.taskIdx;

      onTasksChange((prev) => {
        const next = [...prev];
        next.splice(insertIdx, 0, normalized);
        return next;
      });

      const pid = firstFocusParameterId(normalized);
      if (pid) queueFocus(insertIdx, pid);
    },
    [listIndex, onTasksChange, allowedTemplateIds, queueFocus]
  );

  const handleMoveTask = React.useCallback(
    (
      fromEscIdx: number,
      fromTaskIdx: number,
      toEscIdx: number,
      toTaskIdx: number,
      position: 'before' | 'after'
    ) => {
      if (fromEscIdx === listIndex && toEscIdx === listIndex) {
        onTasksChange((prev) =>
          reorderTasksInList(prev, fromTaskIdx, toTaskIdx, position)
        );
        return;
      }
      onMoveTaskAcrossLists?.(fromEscIdx, fromTaskIdx, toEscIdx, toTaskIdx, position);
    },
    [listIndex, onTasksChange, onMoveTaskAcrossLists]
  );

  const openPrimary = React.useCallback(
    (taskIdx: number, task: TaskSequenceRow) => {
      if (!requestFocusParameter) return;
      if (isMessageLikeEscalationTask(task)) {
        requestFocusParameter({
          kind: 'parameter',
          escalationIdx: listIndex,
          taskIdx,
          parameterId: 'text',
        });
        return;
      }
      const pid = firstFocusParameterId(task);
      if (pid) {
        requestFocusParameter({
          kind: 'parameter',
          escalationIdx: listIndex,
          taskIdx,
          parameterId: pid,
        });
      }
    },
    [listIndex, requestFocusParameter]
  );

  return (
    <CanvasDropWrapper
      onDropTask={handleAppend}
      isEmpty={taskList.length === 0}
      fillAvailable={fillAvailableHeight}
    >
      {taskList.length === 0 ? (
        <PanelEmptyDropZone
          color={color}
          onDropTask={handleAppend}
          compact={!fillAvailableHeight}
          fillAvailable={fillAvailableHeight}
          idleLabel={emptyIdleLabel}
          overLabel={emptyOverLabel}
        />
      ) : (
        <>
        {taskList.map((task, j) => {
          const templateId = task.templateId ?? task.id ?? 'sayMessage';
          const rowKey = task.id ?? `row-${listIndex}-${j}`;
          const isMessageRow = isMessageLikeEscalationTask(task);
          const isEditing = isEditingRow(j);
          const params = Array.isArray(task.parameters) ? task.parameters : [];

          const header = (
            <TaskRowHeader
              icon={
                isMessageRow
                  ? undefined
                  : task.iconName
                    ? getIconComponent(task.iconName, ensureHexColor(task.color))
                    : getTaskIconNode(templateId, ensureHexColor(task.color))
              }
              showMessageIcon={isMessageRow}
              label={isMessageRow ? undefined : task.label ?? getTaskLabel(templateId)}
              color={color}
            />
          );

          const body = (
            <TaskRowBody>
              {params.length === 0 ? (
                <span style={{ color: '#64748b', fontSize: 13 }}>—</span>
              ) : (
                params.map((param) => (
                  <ParameterFieldHost
                    key={param.parameterId}
                    task={task}
                    param={param}
                    translations={effectiveTranslations}
                    escalationIdx={listIndex}
                    taskIdx={j}
                    onCommit={(v) => handleParameterCommit(j, param.parameterId, v)}
                    onEditingActivity={(active) => handleEditingChange(j)(active)}
                    onDeleteTaskIfEmpty={() => handleDelete(j)}
                  />
                ))
              )}
            </TaskRowBody>
          );

          return (
            <TaskRowDnDWrapper
              key={rowKey}
              escalationIdx={listIndex}
              taskIdx={j}
              task={task}
              onMoveTask={handleMoveTask}
              onDropNewTask={(t, to, pos) => handleDropFromViewer(t, to, pos)}
              allowViewerDrop={true}
              isEditing={isEditing}
            >
              <TaskRow
                header={header}
                body={body}
                color={color}
                draggable
                selected={false}
                onDelete={() => handleDelete(j)}
                onEditPrimary={params.length > 0 ? () => openPrimary(j, task) : undefined}
                rowEditorActive={isEditing}
              />
            </TaskRowDnDWrapper>
          );
        })}
        <TaskSequenceAppendDropZone onAppend={handleAppend} />
        </>
      )}
    </CanvasDropWrapper>
  );
}
