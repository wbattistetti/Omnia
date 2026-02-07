/**
 * TaskTree Store Hooks
 *
 * ✅ FASE 3 - MIGRATION COMPLETE: Store is now single source of truth
 *
 * These hooks provide access to the Zustand TaskTree store.
 * All components should use these hooks instead of taskTreeRef.
 */

import { useTaskTreeStore } from './taskTreeStore';
import type { TaskTree } from '@types/taskTypes';

/**
 * Hook to get TaskTree from store
 *
 * This is the primary way to access TaskTree in components.
 * Replaces the old taskTreeRef pattern.
 *
 * @returns TaskTree from store
 */
export function useTaskTreeFromStore(): TaskTree | null {
  return useTaskTreeStore((state) => state.taskTree);
}

/**
 * Hook to get TaskTree version from store (for forcing re-renders)
 *
 * Use this when you need to trigger re-renders based on TaskTree changes.
 *
 * @returns TaskTree version number
 */
export function useTaskTreeVersion(): number {
  return useTaskTreeStore((state) => state.taskTreeVersion);
}
