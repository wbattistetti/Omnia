// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * useSidebar - Composite Hook
 *
 * Sidebar resize + TaskTree mutations via path-based utilities (immutable tree updates).
 * Persists to Zustand store and replaceSelectedTaskTree for dock / manager sync.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTaskTreeStore } from '@responseEditor/core/state';
import {
  createManualTaskTreeNodeWithDefaultBehaviour,
  ensureTaskTreeNodeIds,
  getChildrenOfParent,
  insertChildAt,
  removeNodeByPath,
  reorderSiblings,
  updateNodeByPath,
} from '@responseEditor/core/taskTree';
import type { NodePath } from '@responseEditor/core/taskTree';
import type { Task, TaskMeta, TaskTree } from '@types/taskTypes';
import { TaskType, isUtteranceInterpretationTask } from '@types/taskTypes';
import { getSidebarResizeStartWidthPx } from '@responseEditor/hooks/sidebarResizeStartWidth';
import { variableCreationService } from '@services/VariableCreationService';
import { logVariableScope } from '@utils/debugVariableScope';
import { resolveVariableStoreProjectId } from '@utils/safeProjectId';

export interface UseSidebarParams {
  isDraggingSidebar: boolean;
  setIsDraggingSidebar: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarStartWidthRef: React.MutableRefObject<number>;
  sidebarStartXRef: React.MutableRefObject<number>;
  setSidebarManualWidth: React.Dispatch<React.SetStateAction<number | null>>;
  /** User-resized width; used when ref is missing so drag still starts (aligned with grid column). */
  sidebarManualWidth: number | null;
  sidebarRef: React.RefObject<HTMLDivElement>;
  taskTree: TaskTree | null | undefined;
  replaceSelectedTaskTree: (taskTree: TaskTree) => void;
  /** Sync project variables from TaskTree after each sidebar mutation (UtteranceInterpretation only). */
  utteranceVariableSync?: {
    projectId: string | null | undefined;
    /** Flow canvas that owns this task (utterance variable rows are scoped here). */
    flowId?: string | null;
    taskId: string | undefined;
    taskLabel: string;
    task: Task | TaskMeta | null | undefined;
  };
}

export interface UseSidebarResult {
  handleSidebarResizeStart: (e: React.MouseEvent) => void;
  onChangeSubRequired: (mIdx: number, sIdx: number, required: boolean) => void;
  onReorderSub: (mIdx: number, fromIdx: number, toIdx: number) => void;
  onReorderMain: (fromIdx: number, toIdx: number) => void;
  onAddMain: (label: string) => void;
  onRenameMain: (mIdx: number, label: string) => void;
  onDeleteMain: (mIdx: number) => void;
  onAddSub: (mIdx: number, label: string) => void;
  onRenameSub: (mIdx: number, sIdx: number, label: string) => void;
  onDeleteSub: (mIdx: number, sIdx: number) => void;
  onAddChildAtPath: (parentPath: NodePath | null, label: string) => void;
  onRenameAtPath: (path: NodePath, label: string) => void;
  onDeleteAtPath: (path: NodePath) => void;
  onChangeRequiredAtPath: (path: NodePath, required: boolean) => void;
  onReorderAtPath: (parentPath: NodePath | null, from: number, to: number) => void;
}

export function useSidebar(params: UseSidebarParams): UseSidebarResult {
  const {
    setIsDraggingSidebar,
    sidebarStartWidthRef,
    sidebarStartXRef,
    setSidebarManualWidth,
    sidebarManualWidth,
    sidebarRef,
    taskTree,
    replaceSelectedTaskTree,
    utteranceVariableSync,
  } = params;

  const setTaskTree = useTaskTreeStore((s) => s.setTaskTree);

  const getTree = useCallback((): TaskTree | null => {
    return useTaskTreeStore.getState().taskTree ?? taskTree ?? null;
  }, [taskTree]);

  const commit = useCallback(
    (next: TaskTree) => {
      const ensured = ensureTaskTreeNodeIds(next);
      const prev = getTree();
      if (prev) {
        const prevEnsured = ensureTaskTreeNodeIds(prev);
        if (JSON.stringify(prevEnsured) === JSON.stringify(ensured)) {
          return;
        }
      }
      setTaskTree(ensured);
      try {
        const normalized = useTaskTreeStore.getState().taskTree;
        if (normalized) {
          replaceSelectedTaskTree(normalized);
        }
      } catch {
        /* ignore */
      }

      const sync = utteranceVariableSync;
      const pid = resolveVariableStoreProjectId(sync?.projectId);
      const tid = sync?.taskId != null ? String(sync.taskId).trim() : '';
      const utteranceLike =
        sync?.task &&
        (isUtteranceInterpretationTask(sync.task) || sync.task.type === TaskType.ClassifyProblem);
      if (tid && utteranceLike) {
        variableCreationService.hydrateVariablesFromTaskTree(pid, sync?.flowId, tid, ensured);
        const after = variableCreationService.getVariablesByTaskInstanceId(pid, tid);
        logVariableScope('useSidebar.commit', {
          projectId: pid,
          taskId: tid,
          taskLabel: sync.taskLabel || '',
          nodesCount: ensured.nodes?.length ?? 0,
          varRows: after.length,
          variableIds: after.map((v) => v.id),
        });
        try {
          document.dispatchEvent(new CustomEvent('variableStore:updated', { bubbles: true }));
        } catch {
          /* noop */
        }
      }
    },
    [getTree, setTaskTree, replaceSelectedTaskTree, utteranceVariableSync]
  );

  useEffect(() => {
    try {
      localStorage.removeItem('responseEditor.sidebarWidth');
    } catch {
      /* ignore */
    }
  }, []);

  /** Removes window listeners if drag ends or component unmounts during drag. */
  const sidebarDragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      sidebarDragCleanupRef.current?.();
      sidebarDragCleanupRef.current = null;
    };
  }, []);

  const handleSidebarResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      sidebarDragCleanupRef.current?.();
      sidebarDragCleanupRef.current = null;

      sidebarStartWidthRef.current = getSidebarResizeStartWidthPx({
        sidebarManualWidth,
        sidebarElement: sidebarRef?.current ?? undefined,
      });
      sidebarStartXRef.current = e.clientX;

      const onMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - sidebarStartXRef.current;
        /** Keep room for the manual "Add root data" toolbar (narrower columns break layout). */
        const MIN_WIDTH = 220;
        const MAX_WIDTH = 1000;
        const calculatedWidth = sidebarStartWidthRef.current + deltaX;
        const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, calculatedWidth));
        setSidebarManualWidth(newWidth);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        sidebarDragCleanupRef.current = null;
        setIsDraggingSidebar(false);
      };

      sidebarDragCleanupRef.current = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setIsDraggingSidebar(false);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      setIsDraggingSidebar(true);
    },
    [sidebarManualWidth, sidebarRef, sidebarStartWidthRef, sidebarStartXRef, setIsDraggingSidebar, setSidebarManualWidth]
  );

  const onRenameAtPath = useCallback(
    (path: NodePath, label: string) => {
      const base = getTree();
      if (!base) return;
      const next = updateNodeByPath(base, path, (node) => ({ ...node, label }));
      commit(next);
    },
    [getTree, commit]
  );

  const onDeleteAtPath = useCallback(
    (path: NodePath) => {
      const base = getTree();
      if (!base) return;
      const next = removeNodeByPath(base, path);
      commit(next);
    },
    [getTree, commit]
  );

  const onChangeRequiredAtPath = useCallback(
    (path: NodePath, required: boolean) => {
      const base = getTree();
      if (!base) return;
      const next = updateNodeByPath(base, path, (node) => ({ ...node, required }));
      commit(next);
    },
    [getTree, commit]
  );

  const onReorderAtPath = useCallback(
    (parentPath: NodePath | null, from: number, to: number) => {
      const base = getTree();
      if (!base) return;
      const next = reorderSiblings(base, parentPath, from, to);
      commit(next);
    },
    [getTree, commit]
  );

  const onAddChildAtPath = useCallback(
    (parentPath: NodePath | null, label: string) => {
      const base = getTree();
      if (!base) return;
      const { node: child, treePatch } = createManualTaskTreeNodeWithDefaultBehaviour(label, {
        required: true,
      });
      const siblings = getChildrenOfParent(base, parentPath);
      const next = insertChildAt(base, parentPath, siblings.length, child);
      commit(ensureTaskTreeNodeIds(treePatch(next)));
    },
    [getTree, commit]
  );

  const onChangeSubRequired = useCallback(
    (mIdx: number, sIdx: number, required: boolean) => {
      onChangeRequiredAtPath([mIdx, sIdx], required);
    },
    [onChangeRequiredAtPath]
  );

  const onReorderSub = useCallback(
    (mIdx: number, fromIdx: number, toIdx: number) => {
      onReorderAtPath([mIdx], fromIdx, toIdx);
    },
    [onReorderAtPath]
  );

  const onReorderMain = useCallback(
    (fromIdx: number, toIdx: number) => {
      onReorderAtPath(null, fromIdx, toIdx);
    },
    [onReorderAtPath]
  );

  const onAddMain = useCallback(
    (label: string) => {
      const { node, treePatch } = createManualTaskTreeNodeWithDefaultBehaviour(label, { required: true });
      const base = getTree();
      if (!base) {
        const tree: TaskTree = {
          labelKey: 'manual.root',
          nodes: [node],
          steps: {},
        };
        commit(ensureTaskTreeNodeIds(treePatch(tree)));
        return;
      }
      const roots = base.nodes?.length ?? 0;
      const next = insertChildAt(base, null, roots, node);
      commit(ensureTaskTreeNodeIds(treePatch(next)));
    },
    [getTree, commit]
  );

  const onRenameMain = useCallback(
    (mIdx: number, label: string) => {
      onRenameAtPath([mIdx], label);
    },
    [onRenameAtPath]
  );

  const onDeleteMain = useCallback(
    (mIdx: number) => {
      onDeleteAtPath([mIdx]);
    },
    [onDeleteAtPath]
  );

  const onAddSub = useCallback(
    (mIdx: number, label: string) => {
      onAddChildAtPath([mIdx], label);
    },
    [onAddChildAtPath]
  );

  const onRenameSub = useCallback(
    (mIdx: number, sIdx: number, label: string) => {
      onRenameAtPath([mIdx, sIdx], label);
    },
    [onRenameAtPath]
  );

  const onDeleteSub = useCallback(
    (mIdx: number, sIdx: number) => {
      onDeleteAtPath([mIdx, sIdx]);
    },
    [onDeleteAtPath]
  );

  return {
    handleSidebarResizeStart,
    onChangeSubRequired,
    onReorderSub,
    onReorderMain,
    onAddMain,
    onRenameMain,
    onDeleteMain,
    onAddSub,
    onRenameSub,
    onDeleteSub,
    onAddChildAtPath,
    onRenameAtPath,
    onDeleteAtPath,
    onChangeRequiredAtPath,
    onReorderAtPath,
  };
}
