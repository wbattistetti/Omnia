// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskMeta } from '@taskEditor/EditorHost/types';

/**
 * Helper: safe deep clone that handles circular references
 */
export function safeDeepClone<T>(obj: T): T {
  if (!obj) return obj;
  try {
    // Use structuredClone if available (handles circular refs)
    if (typeof structuredClone !== 'undefined') {
      return structuredClone(obj);
    }
    // Fallback to JSON (may fail on circular refs)
    return JSON.parse(JSON.stringify(obj));
  } catch (err) {
    console.warn('[safeDeepClone] Failed to clone, returning original:', err);
    return obj;
  }
}

/**
 * Helper to convert steps (object or array) to array
 * ✅ Re-exported from core/domain for backward compatibility
 * @deprecated Use getStepsAsArray from core/domain instead
 */
export { getStepsAsArray } from '@responseEditor/core/domain';

/**
 * Helper function to get steps for a node (dictionary lookup diretto)
 * ✅ Re-exported from core/domain for backward compatibility
 * @deprecated Use getStepsForNode from core/domain instead
 */
export { getStepsForNode } from '@responseEditor/core/domain';

/**
 * Check if editing is active (input, textarea, select)
 */
export function isEditingActive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}

/**
 * Type guard: checks if task has templateId (is a TaskMeta)
 */
export function isTaskMeta(task: any): task is TaskMeta {
  return task && typeof task === 'object' && 'templateId' in task;
}

/**
 * Helper: extracts TaskMeta from Task | TaskMeta | undefined
 */
export function getTaskMeta(task: any): TaskMeta | null {
  return isTaskMeta(task) ? task : null;
}
