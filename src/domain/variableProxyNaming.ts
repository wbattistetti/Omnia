/**
 * Single source of truth for proxy variable naming: <semantic_task>.<internal_segment>.
 * All VariableCreationService / Subflow binding / UI code must delegate here.
 */

const CONVERSATIONAL_VERBS_IT =
  /^(chiedi|richiedi|inserisci|fornisci|inserire|fornire|raccogli|dimmi|indica|specifica|descrivi|seleziona|completa)\s+/i;
const CONVERSATIONAL_VERBS_EN =
  /^(ask for|request|enter|provide|insert|collect|tell|specify|describe|select|complete)\s+/i;
/** Italian plural article "i" included (e.g. "i dati personali"). */
const LEADING_ARTICLES = /^(i|la|il|lo|le|gli|un|una|uno|the|a|an)\s+/i;

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
 * Stable snake_case segment for data-style names (aligned with
 * `slugifyManualDataKeySegment` in ResponseEditor manual task tree).
 */
export function slugifyDataKeySegment(input: string): string {
  const s = String(input || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'data';
}

/** Last dotted segment, or full string if no dot. */
export function lastDottedSegment(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  return s.includes('.') ? String(s.split('.').pop() || '').trim() : s;
}

/**
 * Single local label for a subflow task-bound variable (never parent FQ).
 * If `varName` was mistakenly fully qualified (e.g. legacy `dati_personali.colore`), keeps only the last segment and normalizes.
 */
export function localLabelForSubflowTaskVariable(varName: string): string {
  const raw = String(varName || '').trim();
  if (!raw) return '';
  const segment = raw.includes('.') ? lastDottedSegment(raw) : raw;
  return normalizeProxySegment(segment) || segment;
}

/**
 * User-visible qualified label for a Subflow output in the parent: `<SubflowName>.<internal>` (no slugify).
 * Use resolved subflow title (e.g. from labelKey → translations) and internal segment label.
 */
export function buildSubflowQualifiedDisplayLabel(
  subflowTitleDisplay: string,
  internalLabel: string
): string {
  const a = String(subflowTitleDisplay || '').trim() || 'Subflow';
  const b = String(internalLabel || '').trim() || 'value';
  return `${a}.${b}`;
}

/**
 * Parent-flow proxy name for Subflow wiring: `<slug(normalized subflow title)>.<slug(internal segment)>`.
 * Example: "Chiedi i dati personali" + "colore" → `dati_personali.colore`.
 */
export function buildSubflowParentProxyVariableName(
  subflowTitleRaw: string,
  internalOrTaskVarNameRaw: string
): string {
  const titleNorm =
    normalizeSemanticTaskLabel(subflowTitleRaw) || String(subflowTitleRaw || '').trim() || 'subflow';
  const prefix = slugifyDataKeySegment(titleNorm);

  const raw = String(internalOrTaskVarNameRaw || '').trim() || 'value';
  const lastSeg = lastDottedSegment(raw) || raw;
  const internalNorm = normalizeProxySegment(lastSeg) || lastSeg;
  const internal = slugifyDataKeySegment(internalNorm);

  if (!prefix || !internal) {
    throw new Error('Cannot build subflow parent proxy name: empty prefix or internal segment.');
  }
  return `${prefix}.${internal}`;
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
