/**
 * State Layer - Barrel Export
 *
 * Centralized exports for all Zustand stores.
 *
 * ✅ FASE 2.1 - INFRASTRUCTURE: Store structure ready
 * ⚠️ NOT YET USED: Stores will be integrated in future phases
 */

// TaskTree store
export {
  useTaskTreeStore,
  taskTreeSelectors,
} from './taskTreeStore';

// Future stores will be added here:
// - useUIStore (for UI state like panels, modals, etc.)
// - useEditorStore (for editor-specific state)
