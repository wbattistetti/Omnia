/**
 * Single allowed place to derive an initial human-readable label from task/editor text (Rule 5–6).
 * Output is written only to flow.meta.translations[var:<guid>][locale], never stored on VariableInstance.
 */

import { normalizeSemanticTaskLabel } from '../domain/variableProxyNaming';

/**
 * Maps a task row label (e.g. "Chiedi il nome") → "nome" via semantic normalization.
 */
export function generateInitialVariableLabel(taskLabel: string): string {
  const t = normalizeSemanticTaskLabel(String(taskLabel || '').trim());
  return t || 'dato';
}
