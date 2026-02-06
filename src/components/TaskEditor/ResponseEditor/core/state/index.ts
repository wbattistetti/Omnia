/**
 * State Layer - Barrel Export
 *
 * Centralized exports for all Zustand stores.
 *
 * ✅ FASE 2.1 - INFRASTRUCTURE: Store structure ready
 * ✅ FASE 2.2 - PARALLEL IMPLEMENTATION: Sync hooks ready
 * ⚠️ MIGRATION IN PROGRESS: Stores work in parallel with existing code
 */

// TaskTree store
export {
  useTaskTreeStore,
  taskTreeSelectors,
} from './taskTreeStore';

// TaskTree sync hooks (for parallel implementation)
export {
  useTaskTreeSync,
  useTaskTreeFromStore,
  useTaskTreeVersion,
} from './useTaskTreeSync';

// Future stores will be added here:
// - useUIStore (for UI state like panels, modals, etc.)
// - useEditorStore (for editor-specific state)
