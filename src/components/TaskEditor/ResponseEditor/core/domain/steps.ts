/**
 * Steps Domain Operations
 *
 * Pure functions for step operations.
 * No side effects, no dependencies on React or state.
 */

/**
 * Convert steps from array format to dictionary format
 * Supports legacy array format: [{ type: 'start', ... }, ...]
 * Returns dictionary format: { "start": {...}, "noMatch": {...}, ... }
 */
export function convertStepsArrayToDictionary(steps: any): Record<string, any> {
  if (!steps) return {};

  // Already dictionary: use directly
  if (typeof steps === 'object' && !Array.isArray(steps)) {
    return steps;
  }

  // Array: convert to dictionary
  if (Array.isArray(steps)) {
    const result: Record<string, any> = {};
    for (const step of steps) {
      if (step?.type) {
        result[step.type] = {
          type: step.type,
          escalations: step.escalations || [],
          id: step.id
        };
      }
    }
    return result;
  }

  return {};
}

/**
 * Normalize steps to dictionary format
 * Ensures steps are always in dictionary format, converting if necessary
 */
export function normalizeStepsToDictionary(steps: any): Record<string, any> {
  return convertStepsArrayToDictionary(steps);
}

/**
 * Check if steps have content (non-empty)
 */
export function hasStepsContent(steps: any): boolean {
  if (!steps) return false;

  if (typeof steps === 'object' && !Array.isArray(steps)) {
    return Object.keys(steps).length > 0;
  }

  if (Array.isArray(steps)) {
    return steps.length > 0;
  }

  return false;
}

/**
 * Convert steps (object or array) to array format
 * Pure function - no side effects
 */
export function getStepsAsArray(steps: any): any[] {
  if (!steps) return [];
  if (Array.isArray(steps)) return steps;
  // If it's an object, convert it to array
  return Object.entries(steps).map(([key, value]: [string, any]) => ({
    type: key,
    ...value
  }));
}

/**
 * Get steps for a specific node (dictionary lookup)
 * Pure function - O(1) lookup instead of O(n) filter
 */
export function getStepsForNode(steps: any, nodeTemplateId: string): Record<string, any> {
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
    return {}; // Return empty dictionary if invalid
  }
  // Direct lookup: O(1) instead of O(n) filter
  return steps[nodeTemplateId] || {};
}