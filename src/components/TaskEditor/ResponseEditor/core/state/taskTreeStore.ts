/**
 * TaskTree Store (Zustand)
 *
 * Centralized state management for TaskTree in ResponseEditor.
 *
 * ✅ FASE 2.1 - INFRASTRUCTURE: Store structure ready for migration
 * ⚠️ NOT YET USED: This store will replace taskTreeRef in future phases
 *
 * This store will eventually replace:
 * - taskTreeRef (mutable ref used as state - anti-pattern)
 * - taskTree prop (duplicated state)
 * - taskTreeVersion (for forcing re-renders)
 *
 * Benefits:
 * - Single source of truth for TaskTree
 * - Predictable state updates
 * - Easy to test
 * - No prop drilling
 * - Better performance (selective subscriptions)
 */

import { create } from 'zustand';
import type { TaskTree } from '@types/taskTypes';

interface TaskTreeStore {
  // State
  taskTree: TaskTree | null;
  taskTreeVersion: number; // For forcing re-renders when needed

  // Actions
  setTaskTree: (taskTree: TaskTree | null) => void;
  updateTaskTree: (updater: (prev: TaskTree | null) => TaskTree | null) => void;
  incrementVersion: () => void; // Force re-render
  reset: () => void;

  // Selectors (computed values)
  hasTaskTree: () => boolean;
  getMainNodes: () => any[];
  getNodeCount: () => number;
}

const initialState = {
  taskTree: null as TaskTree | null,
  taskTreeVersion: 0,
};

export const useTaskTreeStore = create<TaskTreeStore>((set, get) => ({
  // Initial state
  ...initialState,

  // Actions
  setTaskTree: (taskTree) => {
    set((state) => ({ 
      ...state,
      taskTree, 
      taskTreeVersion: state.taskTreeVersion + 1 
    }));
  },

  updateTaskTree: (updater) => {
    set((state) => {
      const updated = updater(state.taskTree);
      return {
        ...state,
        taskTree: updated,
        taskTreeVersion: state.taskTreeVersion + 1,
      };
    });
  },

  incrementVersion: () => {
    set((state) => ({ ...state, taskTreeVersion: state.taskTreeVersion + 1 }));
  },

  reset: () => {
    set((state) => ({ ...state, ...initialState }));
  },

  // Selectors (must be arrow functions to use get())
  hasTaskTree: () => {
    const state = get();
    if (!state.taskTree) return false;
    const hasNodes = Array.isArray(state.taskTree.nodes) && state.taskTree.nodes.length > 0;
    const hasSteps = state.taskTree.steps && 
                     typeof state.taskTree.steps === 'object' && 
                     !Array.isArray(state.taskTree.steps) &&
                     Object.keys(state.taskTree.steps).length > 0;
    return hasNodes || hasSteps;
  },

  getMainNodes: () => {
    const state = get();
    if (!state.taskTree || !state.taskTree.nodes) return [];
    return state.taskTree.nodes;
  },

  getNodeCount: () => {
    const state = get();
    if (!state.taskTree || !state.taskTree.nodes) return 0;
    return state.taskTree.nodes.length;
  },
}));

/**
 * Selectors for optimized subscriptions
 * Components can subscribe to specific parts of the store
 */
export const taskTreeSelectors = {
  taskTree: (state: TaskTreeStore) => state.taskTree,
  taskTreeVersion: (state: TaskTreeStore) => state.taskTreeVersion,
  hasTaskTree: (state: TaskTreeStore) => state.hasTaskTree(),
  mainNodes: (state: TaskTreeStore) => state.getMainNodes(),
  nodeCount: (state: TaskTreeStore) => state.getNodeCount(),
};
