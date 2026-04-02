/**
 * Display labels for variable rows: utterance node GUIDs prefer project translations;
 * otherwise fall back to in-memory / persisted varName.
 */

/**
 * Resolves picker/token label for a variable instance.
 * For utterance TaskTree nodes (GUID in `utteranceGuidSet`), uses `translationsByGuid[id]` when set.
 */
export function resolveVariableMenuLabel(
  variableId: string,
  varNameFallback: string,
  opts: {
    utteranceGuidSet: Set<string>;
    translationsByGuid?: Record<string, string> | null;
  }
): string {
  const id = String(variableId || '').trim();
  const fb = String(varNameFallback || '').trim();
  if (opts.utteranceGuidSet.has(id) && opts.translationsByGuid) {
    const t = String(opts.translationsByGuid[id] ?? '').trim();
    if (t) return t;
  }
  return fb;
}
