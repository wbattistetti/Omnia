/**
 * Canonical translation keys: `<kind>:<uuid>` — never use bare GUIDs as keys.
 * Kinds: slot | variable | task | flow | interface (interface only for autonomous entities).
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TranslationKeyKind = 'slot' | 'variable' | 'task' | 'flow' | 'interface';

const KINDS = new Set<TranslationKeyKind>(['slot', 'variable', 'task', 'flow', 'interface']);

/** Validates UUID format (strict). */
export function isUuidString(s: string): boolean {
  return typeof s === 'string' && UUID_RE.test(s.trim());
}

/**
 * Builds the canonical translation key for a kind + GUID.
 * @throws if guid is not a valid UUID
 */
export function makeTranslationKey(kind: TranslationKeyKind, guid: string): string {
  const g = String(guid || '').trim();
  if (!isUuidString(g)) {
    throw new Error(`[makeTranslationKey] Invalid GUID for kind "${kind}": ${guid}`);
  }
  if (!KINDS.has(kind)) {
    throw new Error(`[makeTranslationKey] Invalid kind: ${kind}`);
  }
  return `${kind}:${g.toLowerCase()}`;
}

export interface ParsedTranslationKey {
  kind: TranslationKeyKind;
  guid: string;
}

/** Parses `kind:uuid` or returns null if invalid / bare GUID. */
export function parseTranslationKey(key: string): ParsedTranslationKey | null {
  const s = String(key || '').trim();
  const idx = s.indexOf(':');
  if (idx <= 0) return null;
  const kind = s.slice(0, idx) as TranslationKeyKind;
  if (!KINDS.has(kind)) return null;
  const guid = s.slice(idx + 1).trim();
  if (!isUuidString(guid)) return null;
  return { kind, guid: guid.toLowerCase() };
}

/** True if key is a non-empty canonical `kind:uuid` string. */
export function isCanonicalTranslationKey(key: string): boolean {
  return parseTranslationKey(key) !== null;
}

/**
 * Values stored on tasks / messages that resolve to a row in the translations map:
 * canonical `kind:uuid` or legacy DDT `runtime.*` composite keys (not bare UUIDs).
 */
export function translationKeyFromStoredValue(value: string | null | undefined): string | null {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (isCanonicalTranslationKey(v)) return v;
  if (v.startsWith('runtime.')) return v;
  return null;
}

/** True if `key` is allowed as a key in the flat project `translations` map (canonical or `runtime.*`). */
export function isValidTranslationStoreKey(key: string): boolean {
  const k = String(key || '').trim();
  if (!k) return false;
  if (k.startsWith('runtime.')) return true;
  return isCanonicalTranslationKey(k);
}

/**
 * True if a string should not be treated as a human-readable canvas/flow label (opaque id or technical key).
 * Uses {@link translationKeyFromStoredValue} and UUID detection — not regex on translation store keys.
 */
export function looksLikeTechnicalTranslationOrId(value: unknown): boolean {
  const t = String(value ?? '').trim();
  if (!t) return true;
  if (translationKeyFromStoredValue(t) !== null) return true;
  if (t.startsWith('runtime.')) return true;
  if (isUuidString(t)) return true;
  return false;
}
