/**
 * Regex / GrammarFlow helpers. Random ids: use {@link generateSafeGuid} from `./idGenerator`.
 */

export {
  generateSafeGuid,
  SAFE_GUID_PATTERN as REGEX_SAFE_CANONICAL_PATTERN,
  SAFE_GUID_PATTERN_LEGACY as REGEX_SAFE_CANONICAL_PATTERN_LEGACY,
  isSafeGuid as isRegexSafeCanonicalId,
} from './idGenerator';

import { generateSafeGuid } from './idGenerator';

/** @deprecated Use {@link generateSafeGuid} from `./idGenerator`. */
export function generateRegexSafeCanonicalId(): string {
  return generateSafeGuid();
}

/** True if the string is a valid .NET regex named group identifier. */
export function isValidDotNetRegexGroupName(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}
