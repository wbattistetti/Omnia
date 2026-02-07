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
 */
export function getStepsAsArray(steps: any): any[] {
  if (!steps) return [];
  if (Array.isArray(steps)) return steps;
  // Se è un oggetto, convertilo in array
  return Object.entries(steps).map(([key, value]: [string, any]) => ({
    type: key,
    ...value
  }));
}

/**
 * Helper function to get steps for a node (dictionary lookup diretto)
 */
export function getStepsForNode(steps: any, nodeTemplateId: string): Record<string, any> {
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
    return {}; // Ritorna dictionary vuoto se non valido
  }
  // Lookup diretto: O(1) invece di O(n) filter
  return steps[nodeTemplateId] || {};
}

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
