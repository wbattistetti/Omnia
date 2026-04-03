/**
 * Display labels for variable rows in pickers and menus.
 * All user-visible labels come from project translations (see {@link getVariableLabel}).
 */

import { getVariableLabel } from './getVariableLabel';

/**
 * Resolves picker/token label for a variable instance: project translation first,
 * then non-empty fallback (typically {@link VariableInstance.varName}) when the GUID is not in the table.
 */
export function resolveVariableMenuLabel(
  variableId: string,
  fallbackWhenUntranslated: string,
  opts: {
    utteranceGuidSet: Set<string>;
    translationsByGuid?: Record<string, string> | null;
  }
): string {
  const id = String(variableId || '').trim();
  const translations = opts.translationsByGuid ?? {};
  const fb = String(fallbackWhenUntranslated || '').trim();
  return getVariableLabel(id, translations, fb || undefined);
}
