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
