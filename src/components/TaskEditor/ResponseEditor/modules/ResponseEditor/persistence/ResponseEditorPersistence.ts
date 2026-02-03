/**
 * ResponseEditorPersistence
 *
 * Barrel module that re-exports persistence functions.
 * This module provides a single entry point for all persistence operations.
 *
 * The actual implementations are split into:
 * - saveTask.ts: All save operations (saveTaskToRepository, saveTaskOnProjectSave, saveTaskOnEditorClose)
 * - syncTemplate.ts: Template synchronization logic (checkAndApplyTemplateSync)
 */

export {
  saveTaskToRepository,
  saveTaskOnProjectSave,
  saveTaskOnEditorClose,
} from './saveTask';

export {
  checkAndApplyTemplateSync,
} from './syncTemplate';
