/**
 * Steps Domain Operations
 *
 * Pure functions for step operations.
 * No side effects, no dependencies on React or state.
 */

/**
 * @deprecated Use dictionary format directly. This function will throw error in strict mode.
 * DO NOT USE - Steps must be dictionary format
 */
export function convertStepsArrayToDictionary(steps: any): Record<string, any> {
  if (Array.isArray(steps)) {
    throw new Error(
      '[convertStepsArrayToDictionary] DEPRECATED: Steps must be dictionary format, not array. ' +
      'Update your data structure to use dictionary format.'
    );
  }

  if (!steps) return {};
  if (typeof steps === 'object' && !Array.isArray(steps)) {
    return steps;
  }
  return {};
}

/**
 * @deprecated Use dictionary format directly. This function will throw error in strict mode.
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
 * Get steps for a specific node (dictionary lookup) - STRICT
 * Pure function - O(1) lookup instead of O(n) filter
 */
export function getStepsForNode(steps: Record<string, Record<string, any>>, nodeTemplateId: string): Record<string, any> {
  if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
    throw new Error(
      `[getStepsForNode] Steps must be dictionary format. ` +
      `Got: ${Array.isArray(steps) ? 'array' : typeof steps}`
    );
  }

  // ✅ NO FALLBACKS: Returns empty object if nodeTemplateId not found (legitimate default)
  return steps[nodeTemplateId] ?? {};
}