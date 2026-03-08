// Utility functions for error severity normalization
// Backend sends "Error"/"Warning" (PascalCase) or 0/1 (numeric)
// Frontend expects 'error'/'warning' (lowercase)

export type NormalizedSeverity = 'error' | 'warning' | 'hint';

/**
 * Normalizes severity from backend format to frontend format
 * Backend sends "Error"/"Warning" (PascalCase) or 0/1 (numeric)
 * Frontend expects 'error'/'warning' (lowercase)
 */
export function normalizeSeverity(severity: any): NormalizedSeverity {
  if (typeof severity === 'string') {
    const lower = severity.toLowerCase();
    if (lower === 'error' || lower === 'warning' || lower === 'hint') {
      return lower as NormalizedSeverity;
    }
  }
  // Handle numeric values (0 = Error, 1 = Warning, 2 = Hint)
  if (typeof severity === 'number') {
    if (severity === 0) return 'error';
    if (severity === 1) return 'warning';
    if (severity === 2) return 'hint';
  }
  // Default to error if unknown
  console.warn('[severityUtils] Unknown severity value:', severity);
  return 'error';
}
