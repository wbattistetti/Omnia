/**
 * Single source of truth for proxy variable naming: <semantic_task>.<internal_segment>.
 * All VariableCreationService / Subflow binding / UI code must delegate here.
 */

const CONVERSATIONAL_VERBS_IT =
  /^(chiedi|richiedi|inserisci|fornisci|inserire|fornire|raccogli|dimmi|indica|specifica|descrivi|seleziona|completa)\s+/i;
const CONVERSATIONAL_VERBS_EN =
  /^(ask for|request|enter|provide|insert|collect|tell|specify|describe|select|complete)\s+/i;
const LEADING_ARTICLES = /^(la|il|lo|le|gli|un|una|uno|the|a|an)\s+/i;

/**
 * Strips conversational verbs and leading articles (IT/EN) from a task row or segment.
 * Use for both the canvas row label (semantic task) and internal subflow variable labels.
 * e.g. "chiedi la data di nascita" → "data di nascita"
 */
export function normalizeSemanticTaskLabel(raw: string): string {
  let normalized = String(raw || '').trim();
  if (!normalized) return '';

  normalized = normalized.replace(CONVERSATIONAL_VERBS_IT, '');
  normalized = normalized.replace(CONVERSATIONAL_VERBS_EN, '');
  normalized = normalized.replace(LEADING_ARTICLES, '');

  normalized = normalized.trim();
  return normalized || String(raw || '').trim();
}

/** Alias: internal interface / child segment uses the same strip rules. */
export function normalizeProxySegment(raw: string): string {
  return normalizeSemanticTaskLabel(raw);
}

/**
 * Builds `<semanticTask>.<internal>` for parent proxy variables (Subflow outputs, etc.).
 */
export function buildProxyVariableName(taskLabelRaw: string, internalLabelRaw: string): string {
  const source = normalizeSemanticTaskLabel(taskLabelRaw || 'Subflow');
  const child = normalizeProxySegment(internalLabelRaw || 'value');
  if (!source || !child) {
    throw new Error('Cannot build proxy variable name: empty semantic task or internal segment.');
  }
  return `${source}.${child}`;
}

/**
 * Fallback when two rows collide after semantic normalization (import / legacy data).
 * Editor should prevent this; use when a unique name is still required.
 */
export function disambiguateProxyVarName(base: string, isTaken: (name: string) => boolean): string {
  const b = String(base || '').trim();
  if (!b) return b;
  if (!isTaken(b)) return b;
  let n = 2;
  while (isTaken(`${b}_${n}`)) {
    n += 1;
  }
  return `${b}_${n}`;
}
