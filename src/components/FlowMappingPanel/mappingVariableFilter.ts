/**
 * Filtra GUID variabile per ricerca testuale (etichette tradotte + match su id).
 */

import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';

export function filterVariableOptionsByQuery(
  options: string[],
  q: string,
  mergedTr: Record<string, string>
): string[] {
  const t = q.trim().toLowerCase();
  if (!t) return options;
  return options.filter((o) => {
    const id = String(o || '').trim();
    if (!id) return false;
    if (id.toLowerCase().includes(t)) return true;
    return resolveVariableDisplayName(id, 'menuVariables', {
      compiledTranslations: mergedTr,
      flowMetaTranslations: mergedTr,
    })
      .toLowerCase()
      .includes(t);
  });
}
