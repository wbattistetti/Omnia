// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { findPathById } from '@responseEditor/core/taskTree';
import { useTaskTreeFromStore } from '@responseEditor/core/state';
import type { SelectPathHandler } from '@responseEditor/features/node-editing/selectPathTypes';

export interface UseNodeFinderParams {
  handleSelectByPath: SelectPathHandler;
}

/**
 * Finds a node by id in the TaskTree (store) and updates selection to its path.
 */
export function useNodeFinder(params: UseNodeFinderParams) {
  const { handleSelectByPath } = params;
  const taskTreeFromStore = useTaskTreeFromStore();

  const findAndSelectNodeById = useCallback((nodeId: string) => {
    const currentTaskTree = taskTreeFromStore;
    if (!currentTaskTree) {
      return;
    }
    const path = findPathById(currentTaskTree, nodeId);
    if (path && path.length) {
      handleSelectByPath(path);
    }
  }, [taskTreeFromStore, handleSelectByPath]);

  return findAndSelectNodeById;
}
