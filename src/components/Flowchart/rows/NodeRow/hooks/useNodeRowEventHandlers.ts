// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback, useEffect, useRef } from 'react';
import { TaskType } from '@types/taskTypes';
import { EntityCreationService } from '@services/EntityCreationService';
import { emitSidebarRefresh } from '@ui/events';
import { IntellisenseItem } from '@components/Intellisense/IntellisenseTypes';
import { RowHeuristicsHandler } from '../application/RowHeuristicsHandler';
import { RowSaveHandler } from '../application/RowSaveHandler';
import { RowTypeHandler } from '../application/RowTypeHandler';
import { FactoryTaskCreator } from '../application/FactoryTaskCreator';
import { IntellisenseSelectionHandler } from '../application/IntellisenseSelectionHandler';
import { taskTypeToTemplateId } from '@types/taskTypes';
import type { Row } from '@types/NodeRowTypes';
import { taskRepository } from '@services/TaskRepository';
import { logNodeRowEdit } from '../nodeRowEditDebug';

export interface UseNodeRowEventHandlersProps {
  row: Row;
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  showIntellisense: boolean;
  setShowIntellisense: (value: boolean) => void;
  intellisenseQuery: string;
  setIntellisenseQuery: (value: string) => void;
  setShowCreatePicker: (value: boolean) => void;
  setAllowCreatePicker: (value: boolean) => void;
  setPickerPosition: (pos: { left: number; top: number } | null) => void;
  setPickerCurrentType: (type: TaskType | undefined) => void;
  setShowIcons: (value: boolean) => void;
  suppressIntellisenseRef: React.MutableRefObject<boolean>;
  intellisenseTimerRef: React.MutableRefObject<number | null>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  labelRef: React.RefObject<HTMLElement>;
  projectData: any;
  onUpdate: (row: Row, label: string) => void;
  onUpdateWithCategory?: (row: Row, label: string, categoryType?: string, meta?: any) => void;
  onDelete: (row: Row) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onEditingEnd?: (rowId?: string) => void;
  onCreateFactoryTask?: (name: string, onRowUpdate?: (item: any) => void, scope?: 'global' | 'industry', categoryName?: string, type?: string) => void;
  getProjectId?: () => string | undefined;
  toolbarSM: {
    picker: {
      close: () => void;
      open: () => void;
    };
  };
}

export interface UseNodeRowEventHandlersReturn {
  handleCancel: () => void;
  handleKeyDownInternal: (e: React.KeyboardEvent) => Promise<void>;
  handleTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handlePickType: (selectedTaskTypeOrTask: TaskType | { task: any }) => Promise<void>;
  handleIntellisenseSelect: (item: IntellisenseItem) => Promise<void>;
  handleIntellisenseClose: () => void;
  handleDoubleClick: (e?: React.MouseEvent) => void;
  enterEditing: () => void;
}

/**
 * Custom hook that encapsulates all event handlers for NodeRow.
 * This significantly reduces the size of the main component by extracting
 * all handler logic into a separate, testable hook.
 */
export function useNodeRowEventHandlers(
  props: UseNodeRowEventHandlersProps
): UseNodeRowEventHandlersReturn {
  const {
    row,
    isEditing,
    setIsEditing,
    showIntellisense,
    setShowIntellisense,
    intellisenseQuery,
    setIntellisenseQuery,
    setShowCreatePicker,
    setAllowCreatePicker,
    setPickerPosition,
    setPickerCurrentType,
    setShowIcons,
    suppressIntellisenseRef,
    intellisenseTimerRef,
    inputRef,
    labelRef,
    projectData,
    onUpdate,
    onUpdateWithCategory,
    onDelete,
    onKeyDown,
    onEditingEnd,
    onCreateFactoryTask,
    getProjectId,
    toolbarSM,
  } = props;

  const enterEditing = useCallback(() => {
    setIsEditing(true);
    setShowCreatePicker(false);
    setAllowCreatePicker(false);
  }, [setIsEditing, setShowCreatePicker, setAllowCreatePicker]);

  /**
   * When leaving edit mode, persist task/message side effects once.
   * Label text is already committed on each change via {@link handleTextChange} → `onUpdate`.
   */
  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    const wasEditing = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (!wasEditing || isEditing) {
      return;
    }
    const label = row.text ?? '';
    logNodeRowEdit('exitEditing.persist', {
      rowId: row.id,
      labelLength: label.length,
      labelEmpty: label.trim() === '',
    });
    void (async () => {
      try {
        if (onUpdateWithCategory) {
          (onUpdateWithCategory as any)(row, label, (row as any)?.categoryType, { message: { text: label } });
        }
      } catch {
        /* ignore */
      }
      try {
        let getCurrentProjectId: (() => string | undefined) | undefined = undefined;
        try {
          const runtime = require('../../state/runtime') as any;
          getCurrentProjectId = runtime.getCurrentProjectId;
        } catch {
          /* ignore */
        }
        const saveHandler = new RowSaveHandler({
          row,
          getProjectId,
          getCurrentProjectId,
        });
        await saveHandler.saveRow(label);
      } catch (err) {
        console.error('[NodeRow] persist on exit editing', err);
      }
    })();
  }, [isEditing, row, getProjectId, onUpdateWithCategory]);

  const handleCancel = useCallback(() => {
    if ((row.text || '').trim() === '') {
      onDelete(row);
    } else {
      setIsEditing(false);
      setShowIntellisense(false);
      setIntellisenseQuery('');
    }
  }, [row, setIsEditing, setShowIntellisense, setIntellisenseQuery, onDelete]);

  const handleKeyDownInternal = useCallback(async (e: React.KeyboardEvent) => {
    const dbg = (() => { try { return Boolean(localStorage.getItem('debug.picker')); } catch { return false; } })();

    if (e.key === '/' && !showIntellisense) {
      setIntellisenseQuery('');
      setShowIntellisense(true);
      setAllowCreatePicker(false);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (showIntellisense) {
        setShowIntellisense(false);
        setIntellisenseQuery('');
        setShowCreatePicker(false);
      } else {
        if (onKeyDown) onKeyDown(e);
        handleCancel();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const q = (row.text || '').trim();

      // ✅ Se la riga è vuota, cancellala immediatamente invece di processare Enter
      if (q === '') {
        logNodeRowEdit('key.enter.emptyDelete', { rowId: row.id });
        onDelete(row);
        setIsEditing(false);
        setShowIntellisense(false);
        setIntellisenseQuery('');
        return;
      }

      if ((row as any)?.categoryType === 'conditions') {
        try {
          const created = EntityCreationService.createCondition({
            name: q,
            projectData,
            projectIndustry: (projectData as any)?.industry,
            scope: 'industry'
          });
          if (created) {
            if (onUpdateWithCategory) {
              (onUpdateWithCategory as any)(row, q, 'conditions', { conditionId: created.id });
            } else {
              onUpdate(row, q);
            }
            setIsEditing(false);
            setShowIntellisense(false);
            setIntellisenseQuery('');
            try { emitSidebarRefresh(); } catch { }
          }
        } catch (err) {
          try { console.warn('[CondFlow] quick-create failed', err); } catch { }
        }
        return;
      }

      if (e.altKey) {
        if (dbg) { }
        setIntellisenseQuery(q);
        setShowIntellisense(false);
        setAllowCreatePicker(true);
        setShowCreatePicker(true);
        try { inputRef.current?.blur(); } catch { }
        return;
      }

      const projectId = getProjectId?.(); // ✅ FIX: Get projectId for loading project-specific embeddings
      const heuristicsResult = await RowHeuristicsHandler.analyzeRowLabel(q, projectId); // ✅ FIX: Pass projectId

      if (heuristicsResult.success) {
        const rowUpdateData = RowHeuristicsHandler.prepareRowUpdateData(row, q, heuristicsResult);
        const updatedRow = {
          ...row,
          ...rowUpdateData,
        };
        onUpdate(updatedRow as any, q);
        setIsEditing(false);
        return;
      } else {
        // ✅ Show error clearly to user when embedding service fails
        const errorMessage = heuristicsResult.error?.message || 'Unknown error during template matching';
        console.error('[NodeRow] ❌ Heuristics failed - Embedding service error:', {
          error: heuristicsResult.error,
          errorMessage,
          label: q
        });

        // Show alert to user with clear error message
        alert(`❌ Embedding Service Error\n\n${errorMessage}\n\nPlease ensure the Python FastAPI service is running (npm run be:apiNew).`);

        // Fallback to picker so user can still create task manually
        setIntellisenseQuery(q);
        setShowIntellisense(false);
        setAllowCreatePicker(true);
        setShowCreatePicker(true);
        try { inputRef.current?.blur(); } catch { }
        return;
      }
    }
  }, [showIntellisense, row, projectData, onUpdate, onUpdateWithCategory, onKeyDown, handleCancel, setIsEditing, setShowIntellisense, setIntellisenseQuery, setShowCreatePicker, setAllowCreatePicker, inputRef, onDelete]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    onUpdate(row, newText);
    logNodeRowEdit('commit.change', {
      rowId: row.id,
      length: newText.length,
      isEmpty: newText.trim() === '',
    });
    const q = newText.trim();
    setAllowCreatePicker(false);
    setShowCreatePicker(false);
    if (intellisenseTimerRef.current) {
      window.clearTimeout(intellisenseTimerRef.current);
      intellisenseTimerRef.current = null;
    }
    if (q.length >= 2) {
      setIntellisenseQuery(newText);
      intellisenseTimerRef.current = window.setTimeout(() => {
        if (!suppressIntellisenseRef.current) {
          setShowIntellisense(true);
        }
      }, 100);
    } else {
      setShowIntellisense(false);
      setIntellisenseQuery('');
    }
  }, [row, onUpdate, setAllowCreatePicker, setShowCreatePicker, setShowIntellisense, setIntellisenseQuery, intellisenseTimerRef, suppressIntellisenseRef]);

  const handlePickType = useCallback(async (selectedTaskTypeOrTask: TaskType | { task: any }) => {
    const isTaskObject = typeof selectedTaskTypeOrTask === 'object' && 'task' in selectedTaskTypeOrTask;
    const selectedTaskType: TaskType | null = isTaskObject ? null : (selectedTaskTypeOrTask as TaskType);
    const selectedTask = isTaskObject ? (selectedTaskTypeOrTask as { task: any }).task : null;

    setShowCreatePicker(false);
    setAllowCreatePicker(false);
    setShowIntellisense(false);
    const label = (row.text || '').trim();

    if (!label) {
      setIsEditing(false);
      return;
    }

    if (!isEditing && onUpdateWithCategory) {
      const typeHandler = new RowTypeHandler({
        row,
        getProjectId,
      });

      const result = await typeHandler.changeRowType(selectedTaskType, selectedTask, row.text);

      if (result.success) {
        const typeString =
          result.taskType === TaskType.SayMessage
            ? 'Message'
            : result.taskType === TaskType.UtteranceInterpretation
              ? 'UtteranceInterpretation'
              : result.taskType === TaskType.BackendCall
                ? 'BackendCall'
                : result.taskType === TaskType.ClassifyProblem
                  ? 'ProblemClassification'
                  : result.taskType === TaskType.AIAgent
                    ? 'AIAgent'
                    : result.taskType === TaskType.Summarizer
                      ? 'Summarizer'
                      : result.taskType === TaskType.Negotiation
                        ? 'Negotiation'
                        : result.taskType === TaskType.FaqAnswering
                          ? 'FaqAnswering'
                        : result.taskType === TaskType.Subflow
                          ? 'Subflow'
                          : isTaskObject && selectedTask
                            ? 'Other'
                            : 'Message';

        const updateMeta = {
          id: row.id,
          type: typeString,
          heuristics: {
            ...((row as any)?.heuristics || {}),
            type: result.taskType,
          },
          factoryId: (row as any).factoryId,
          isUndefined: false,
        };

        (onUpdateWithCategory as any)(row, row.text, 'taskTemplates', updateMeta);
      } else {
        console.error('❌ [CHANGE_TYPE] Failed to change row type:', result.error);
      }
      toolbarSM.picker.close();
      return;
    }

    if (onCreateFactoryTask && isEditing) {
      if (isTaskObject && selectedTask) {
        const typeHandler = new RowTypeHandler({
          row,
          getProjectId,
        });

        const result = await typeHandler.createTaskForNewRow(selectedTaskType, selectedTask, label);

        if (result.success) {
          const updateMeta = {
            id: row.id,
            type: 'Other',
            heuristics: {
              ...((row as any)?.heuristics || {}),
              type: result.taskType,
            },
            isUndefined: false,
          };

          if (onUpdateWithCategory) {
            (onUpdateWithCategory as any)(row, label, 'taskTemplates', updateMeta);
          } else {
            onUpdate({ ...row, isUndefined: false } as any, label);
          }
        }

        setIsEditing(false);
        setShowIntellisense(false);
        setIntellisenseQuery('');
        toolbarSM.picker.close();
        return;
      }

      // Flow type: create/update local task only (no factory task)
      if (selectedTaskType === TaskType.Subflow) {
        const typeHandler = new RowTypeHandler({ row, getProjectId });
        const result = await typeHandler.createTaskForNewRow(selectedTaskType, null, label);
        if (result.success) {
          const updateMeta = {
            id: row.id,
            type: 'Subflow',
            heuristics: { ...((row as any)?.heuristics || {}), type: TaskType.Subflow },
            isUndefined: false,
          };
          if (onUpdateWithCategory) {
            (onUpdateWithCategory as any)(row, label, 'taskTemplates', updateMeta);
          } else {
            onUpdate({ ...row, ...updateMeta } as any, label);
          }
        }
        setIsEditing(false);
        setShowIntellisense(false);
        setIntellisenseQuery('');
        toolbarSM.picker.close();
        return;
      }

      const factoryTaskCreator = new FactoryTaskCreator({
        row,
        getProjectId,
        onCreateFactoryTask,
        onUpdate,
        onUpdateWithCategory,
        onStateUpdate: {
          setIsEditing,
          setShowIntellisense,
          setIntellisenseQuery,
          closePicker: () => toolbarSM.picker.close(),
        },
      });

      const result = await factoryTaskCreator.createFactoryTask(label, selectedTaskType);

      if (result.success) {
        return;
      } else {
        setIsEditing(false);
        return;
      }
    }

    const typeHandler = new RowTypeHandler({
      row,
      getProjectId,
    });

    const key = selectedTaskType !== null ? taskTypeToTemplateId(selectedTaskType) || '' : '';

    const result = await typeHandler.createTaskForNewRow(selectedTaskType, selectedTask, label);

    if (result.success) {
      const immediate = (patch: any) => {
        if (onUpdateWithCategory) {
          (onUpdateWithCategory as any)(row, label, 'taskTemplates', patch);
        } else {
          onUpdate(row, label);
        }
      };

      immediate({
        id: row.id,
        type: key,
        mode: undefined,
      });

      try {
        emitSidebarRefresh();
      } catch {
        // Ignore errors
      }
    }
  }, [isEditing, onCreateFactoryTask, onUpdate, onUpdateWithCategory, row, getProjectId, toolbarSM, setIsEditing, setShowIntellisense, setIntellisenseQuery, setShowCreatePicker, setAllowCreatePicker]);

  const handleIntellisenseSelect = useCallback(async (item: IntellisenseItem) => {
    setShowIntellisense(false);
    setIntellisenseQuery('');

    try {
      let getCurrentProjectId: (() => string | undefined) | undefined = undefined;
      try {
        const runtime = require('../../state/runtime') as any;
        getCurrentProjectId = runtime.getCurrentProjectId;
      } catch {
        // Ignore if runtime module is not available
      }

      const handler = new IntellisenseSelectionHandler({
        row,
        item,
        getProjectId,
        getCurrentProjectId,
      });

      const result = await handler.handleSelection();

      if (result.success && result.updateData) {
        if (onUpdateWithCategory) {
          (onUpdateWithCategory as any)(row, item.name, item.categoryType, result.updateData);
        } else {
          onUpdate(row, item.name);
        }
      } else {
        if (onUpdateWithCategory) {
          (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
            factoryId: item.factoryId,
            type: (item as any)?.type,
            mode: (item as any)?.mode,
            userActs: item.userActs,
            categoryType: item.categoryType,
          });
        } else {
          onUpdate(row, item.name);
        }
      }
    } catch (error) {
      console.error('[NodeRow][handleIntellisenseSelect] Error handling selection:', error);
      if (onUpdateWithCategory) {
        (onUpdateWithCategory as any)(row, item.name, item.categoryType, {
          factoryId: item.factoryId,
          type: (item as any)?.type,
          mode: (item as any)?.mode,
          userActs: item.userActs,
          categoryType: item.categoryType
        });
      } else {
        onUpdate(row, item.name);
      }
    }

    setIsEditing(false);
    setShowCreatePicker(false);
  }, [row, getProjectId, onUpdate, onUpdateWithCategory, setShowIntellisense, setIntellisenseQuery, setIsEditing, setShowCreatePicker]);

  const handleIntellisenseClose = useCallback(() => {
    setShowIntellisense(false);
    setIntellisenseQuery('');
    setShowCreatePicker(false);
  }, [setShowIntellisense, setIntellisenseQuery, setShowCreatePicker]);

  const handleDoubleClick = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    enterEditing();
  }, [enterEditing]);

  return {
    handleCancel,
    handleKeyDownInternal,
    handleTextChange,
    handlePickType,
    handleIntellisenseSelect,
    handleIntellisenseClose,
    handleDoubleClick,
    enterEditing,
  };
}
