/**
 * Single source of truth for new random identifiers in the frontend.
 *
 * `generateSafeGuid` produces strings that are:
 * - 128-bit random (same strength as UUID v4 payload)
 * - valid as .NET regex named group names (letter start, [A-Za-z0-9_])
 * - usable as opaque IDs everywhere (tasks, nodes, slots, edges, etc.)
 *
 * Format: `g_` + 32 lowercase hex digits (no hyphens).
 */

const RFC_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** New canonical safe ids from {@link generateSafeGuid}. */
export const SAFE_GUID_PATTERN = /^g_[a-f0-9]{32}$/;

/** Legacy short safe ids (g_ + 12 hex); still accepted in some validators. */
export const SAFE_GUID_PATTERN_LEGACY = /^g_[a-f0-9]{12,32}$/i;

export function generateSafeGuid(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `g_${hex}`;
}

/**
 * @deprecated Use {@link generateSafeGuid}. Kept as an alias so existing imports keep working.
 */
export const generateId = (): string => generateSafeGuid();

/**
 * True for RFC UUID strings or for safe guids from {@link generateSafeGuid}.
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return RFC_UUID.test(id) || SAFE_GUID_PATTERN.test(id);
}

/**
 * True only for ids produced by {@link generateSafeGuid} (current canonical format).
 */
export function isSafeGuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return SAFE_GUID_PATTERN.test(id);
}

/**
 * @deprecated Prefer {@link generateSafeGuid}. Short hex slice; do not use for new code if a full safe guid is needed.
 */
export const generateShortId = (): string => {
  return generateSafeGuid().slice(2, 26);
};
