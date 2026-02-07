/**
 * State Layer - Barrel Export
 *
 * Centralized exports for all Zustand stores.
 *
 * ✅ FASE 3 - MIGRATION COMPLETE: Store is now single source of truth
 * ✅ All hooks and components now use Zustand store instead of taskTreeRef
 */

// TaskTree store
export {
  useTaskTreeStore,
  taskTreeSelectors,
} from './taskTreeStore';

// TaskTree store hooks
export {
  useTaskTreeFromStore,
  useTaskTreeVersion,
} from './useTaskTreeSync';

// Future stores will be added here:
// - useUIStore (for UI state like panels, modals, etc.)
// - useEditorStore (for editor-specific state)
