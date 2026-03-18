/**
 * ResponseEditorPersistence
 *
 * Barrel module that re-exports persistence functions.
 * This module provides a single entry point for all persistence operations.
 *
 * The actual implementations are split into:
 * - saveTask.ts: Unified save function and legacy wrappers
 * - syncTemplate.ts: Template synchronization logic (checkAndApplyTemplateSync)
 */

// New unified API
export { saveTask } from './saveTask';
export type { SaveTaskOptions } from './saveTask';

// Legacy wrappers (deprecated - use saveTask instead)
export {
  saveTaskToRepository,
  saveTaskOnProjectSave,
  saveTaskOnEditorClose,
} from './saveTask';

export {
  checkAndApplyTemplateSync,
} from './syncTemplate';
