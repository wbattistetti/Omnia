/**
 * Stable fingerprint for Grammar identity that ignores volatile UUID churn.
 * Empty graphs with different ids must compare equal to avoid contract↔store oscillation.
 */

import type { Grammar } from './types/grammarTypes';

export function grammarStructuralFingerprint(g: Grammar | null | undefined): string {
  if (!g) return 'null';
  const { id: _omitId, ...rest } = g;
  try {
    return JSON.stringify(rest);
  } catch {
    return 'error';
  }
}
