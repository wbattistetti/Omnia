/**
 * Reference scan haystack: concatenates only persisted GUID-based text (no label resolution here).
 * Label → GUID happens at edit save / compile time (see referenceScanCompile.ts).
 */

/** Persisted corpus on Task / serialized task JSON in extra chunks. */
export const REFERENCE_SCAN_INTERNAL_TEXT_KEY = 'referenceScanInternalText' as const;

/**
 * Text used for variable reference scanning on a condition expression.
 * Prefers explicit internalReferenceText, then compiled JS, then executable DSL (GUID), never raw script.
 */
export function conditionExpressionTextForReferenceScan(
  ex:
    | {
        internalReferenceText?: string;
        compiledCode?: string;
        compiledText?: string;
        executableCode?: string;
        script?: string;
      }
    | undefined
): string {
  if (!ex) return '';
  const ir = String(ex.internalReferenceText || '').trim();
  if (ir) return ir;
  const compiled = String(ex.compiledCode || ex.compiledText || '').trim();
  if (compiled) return compiled;
  const exec = String(ex.executableCode || '').trim();
  if (exec) return exec;
  return '';
}

export type BuildInternalReferenceHaystackParams = {
  /** GUID-only strings (condition internal / executable / compiled). */
  conditionInternalTexts: string[];
  taskJsonChunks: string[];
  /** Optional: precompiled translation values (GUID form), same keys as UI translations. */
  translationsInternal?: Record<string, string>;
  extraCorpusChunks?: string[];
};

/**
 * Concatenates persisted internal text only. No variables map, no label parsing.
 */
export function buildInternalReferenceHaystackForParentFlow(
  params: BuildInternalReferenceHaystackParams
): string {
  const parts: string[] = [];

  for (const chunk of params.conditionInternalTexts) {
    const t = String(chunk || '').trim();
    if (t) parts.push(t);
  }

  for (const json of params.taskJsonChunks) {
    if (!json) continue;
    try {
      const taskObj = JSON.parse(json) as Record<string, unknown>;
      const persisted = taskObj[REFERENCE_SCAN_INTERNAL_TEXT_KEY];
      if (typeof persisted === 'string' && persisted.trim()) {
        parts.push(persisted);
      }
    } catch {
      /* invalid JSON — skip */
    }
  }

  if (params.translationsInternal && typeof params.translationsInternal === 'object') {
    for (const v of Object.values(params.translationsInternal)) {
      if (v) parts.push(String(v));
    }
  }

  for (const x of params.extraCorpusChunks ?? []) {
    if (!x) continue;
    try {
      const parsed = JSON.parse(x) as Record<string, unknown>;
      const p = parsed[REFERENCE_SCAN_INTERNAL_TEXT_KEY];
      if (typeof p === 'string' && p.trim()) parts.push(p);
    } catch {
      /* skip */
    }
  }

  return parts.join('\n');
}

/** @deprecated Use conditionExpressionTextForReferenceScan */
export const internalConditionExpressionText = conditionExpressionTextForReferenceScan;
