/**
 * useTaskTreeSync Hook
 *
 * ✅ FASE 2.2 - PARALLEL IMPLEMENTATION: Syncs Zustand store with taskTreeRef
 *
 * This hook allows the Zustand store to work in parallel with taskTreeRef
 * without breaking existing code. It synchronizes both directions:
 * - When taskTreeRef changes → update store
 * - When store changes → update taskTreeRef (optional, for backward compatibility)
 *
 * ⚠️ TEMPORARY: This is a bridge during migration. Will be removed in Fase 2.3.
 *
 * Usage:
 * ```tsx
 * const taskTreeRef = useRef<TaskTree | null>(null);
 * useTaskTreeSync(taskTreeRef, taskTree); // Syncs store with ref
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { useTaskTreeStore } from './taskTreeStore';
import type { TaskTree } from '@types/taskTypes';

interface UseTaskTreeSyncOptions {
  /**
   * If true, store changes will also update the ref (bidirectional sync)
   * Default: false (only ref → store)
   */
  bidirectional?: boolean;

  /**
   * If true, sync is enabled
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Syncs Zustand store with taskTreeRef
 *
 * @param taskTreeRef - The ref to sync with
 * @param taskTree - The current taskTree prop (fallback)
 * @param options - Sync options
 */
export function useTaskTreeSync(
  taskTreeRef: React.MutableRefObject<TaskTree | null | undefined>,
  taskTree: TaskTree | null | undefined,
  options: UseTaskTreeSyncOptions = {}
): void {
  const { bidirectional = false, enabled = true } = options;
  const { setTaskTree, taskTree: storeTaskTree } = useTaskTreeStore();
  const lastSyncedRef = useRef<TaskTree | null | undefined>(null);

  // Sync ref → store (when ref changes)
  useEffect(() => {
    if (!enabled) return;

    const currentRefValue = taskTreeRef.current;
    const currentValue = currentRefValue || taskTree;

    // ✅ CRITICAL: Only sync if value actually changed AND is not null
    // Don't overwrite store with null if store already has a value (DDTHostAdapter may have populated it)
    if (currentValue !== lastSyncedRef.current && currentValue) {
      lastSyncedRef.current = currentValue;
      setTaskTree(currentValue);
    }
  }, [taskTreeRef.current, taskTree, enabled, setTaskTree]);

  // Sync store → ref (bidirectional, optional)
  useEffect(() => {
    if (!enabled || !bidirectional) return;

    if (storeTaskTree && storeTaskTree !== taskTreeRef.current) {
      taskTreeRef.current = storeTaskTree;
      lastSyncedRef.current = storeTaskTree;
    }
  }, [storeTaskTree, bidirectional, enabled, taskTreeRef]);
}

/**
 * Hook to get TaskTree from store (alternative to using ref)
 *
 * This can be used in components that want to read from store instead of ref.
 *
 * @returns TaskTree from store
 */
export function useTaskTreeFromStore(): TaskTree | null {
  return useTaskTreeStore((state) => state.taskTree);
}

/**
 * Hook to get TaskTree version from store (for forcing re-renders)
 *
 * @returns TaskTree version number
 */
export function useTaskTreeVersion(): number {
  return useTaskTreeStore((state) => state.taskTreeVersion);
}
