// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { GROUP_NAME_PATTERN } from './regexGroupUtils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubDataMappingEntry = {
  canonicalKey: string;
  groupName: string;
  label?: string;
  type?: string;
};

export type SubDataMapping = Record<string, SubDataMappingEntry>;

/**
 * Internal display map produced by buildDisplayMap.
 * guidToDisplay: g_xxxxxxxxxxxx  → sanitized label (shown in editor)
 * displayToGuid: sanitized label → g_xxxxxxxxxxxx (used when normalizing)
 */
export type DisplayMap = {
  guidToDisplay: Map<string, string>;
  displayToGuid: Map<string, string>;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize a raw label string so it is safe to use as a regex named-group
 * identifier (only letters, digits, underscores; must start with a letter
 * or underscore).
 */
function sanitizeLabel(raw: string): string {
  // Replace every character that is not a letter, digit, or underscore
  let sanitized = raw.replace(/[^a-zA-Z0-9_]/g, '_');
  // Named groups cannot start with a digit
  if (sanitized.length === 0 || /^[0-9]/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized;
}

/**
 * Escape a string for use as a literal inside a RegExp.
 */
function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a bidirectional map between GUID group names and human-readable
 * display labels.  Must be deterministic so that renderRegexForEditor and
 * normalizeRegexFromEditor are perfect inverses of each other.
 *
 * Rules:
 *   1. Only entries with a valid GroupName (g_[a-f0-9]{12}) are included.
 *   2. Display label = sanitize(entry.label ?? entry.canonicalKey ?? entry.groupName)
 *   3. Collisions are resolved by appending _1, _2 … in iteration order.
 */
export function buildDisplayMap(subDataMapping: SubDataMapping): DisplayMap {
  const guidToDisplay = new Map<string, string>();
  const displayToGuid = new Map<string, string>();

  // Track how many times each base name has appeared so far
  const baseCount = new Map<string, number>();

  for (const [, entry] of Object.entries(subDataMapping)) {
    const { groupName, label, canonicalKey } = entry;

    // Skip entries without a valid GUID group name
    if (!groupName || !GROUP_NAME_PATTERN.test(groupName)) {
      continue;
    }

    const base = sanitizeLabel(label || canonicalKey || groupName);
    const count = baseCount.get(base) ?? 0;
    const displayName = count === 0 ? base : `${base}_${count}`;
    baseCount.set(base, count + 1);

    guidToDisplay.set(groupName, displayName);
    displayToGuid.set(displayName, groupName);
  }

  return { guidToDisplay, displayToGuid };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transforms a technical regex (containing GUID group names such as
 * `(?<g_1a2b3c4d5e6f>...)`) into a human-readable regex (containing label-
 * based group names such as `(?<Giorno>...)`) for display inside the Monaco
 * editor.
 *
 * This function is the inverse of normalizeRegexFromEditor.  Both functions
 * share the same buildDisplayMap logic so the round-trip is guaranteed.
 *
 * @param techRegex       - The regex stored in the NLP contract (GUID groups).
 * @param subDataMapping  - The SubDataMapping record from the contract.
 * @returns The regex with human-readable group names (unchanged if no GUID
 *          groups are present or the mapping is empty).
 */
export function renderRegexForEditor(
  techRegex: string,
  subDataMapping: SubDataMapping
): string {
  if (!techRegex || Object.keys(subDataMapping).length === 0) {
    return techRegex;
  }

  const { guidToDisplay } = buildDisplayMap(subDataMapping);
  if (guidToDisplay.size === 0) {
    return techRegex;
  }

  let result = techRegex;
  for (const [guid, displayName] of guidToDisplay.entries()) {
    result = result.replace(
      new RegExp(`\\(\\?<${escapeForRegex(guid)}>`, 'g'),
      `(?<${displayName}>`
    );
  }
  return result;
}

/**
 * Transforms a human-readable regex (containing label-based group names such
 * as `(?<Giorno>...)`) back into the technical regex (containing GUID group
 * names such as `(?<g_1a2b3c4d5e6f>...)`) ready for storage in the NLP
 * contract.
 *
 * This function is the inverse of renderRegexForEditor.
 *
 * @param humanRegex      - The regex as shown/edited in the Monaco editor.
 * @param subDataMapping  - The SubDataMapping record from the contract.
 * @returns The technical regex with GUID group names.
 * @throws  Error if the regex contains named groups that cannot be mapped back
 *          to any GUID (i.e., the user invented or modified a label).
 */
export function normalizeRegexFromEditor(
  humanRegex: string,
  subDataMapping: SubDataMapping
): string {
  if (!humanRegex || Object.keys(subDataMapping).length === 0) {
    return humanRegex;
  }

  const { displayToGuid } = buildDisplayMap(subDataMapping);
  if (displayToGuid.size === 0) {
    return humanRegex;
  }

  let result = humanRegex;
  for (const [displayName, guid] of displayToGuid.entries()) {
    result = result.replace(
      new RegExp(`\\(\\?<${escapeForRegex(displayName)}>`, 'g'),
      `(?<${guid}>`
    );
  }

  // Post-normalization check: no named group should remain with a non-GUID name.
  const residualGroups = extractNamedGroups(result).filter(
    (g) => !GROUP_NAME_PATTERN.test(g)
  );
  if (residualGroups.length > 0) {
    const validLabels = Array.from(displayToGuid.keys()).join(', ');
    throw new Error(
      `Unrecognized group name(s) in regex after normalization: [${residualGroups.join(', ')}]. ` +
      `Valid labels are: [${validLabels}]. ` +
      `Do not rename or invent group labels — only modify the pattern inside the parentheses.`
    );
  }

  return result;
}

/**
 * Returns true when the given regex contains at least one GUID-format named
 * group (i.e., it is already in the technical/stored form).
 */
export function hasGuidGroupNames(regex: string): boolean {
  if (!regex) return false;
  const pattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(regex)) !== null) {
    if (GROUP_NAME_PATTERN.test(match[1])) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Private helpers (not exported)
// ---------------------------------------------------------------------------

function extractNamedGroups(regex: string): string[] {
  const pattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
  const groups: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(regex)) !== null) {
    groups.push(match[1]);
  }
  return groups;
}
