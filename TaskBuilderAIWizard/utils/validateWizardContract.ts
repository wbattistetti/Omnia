// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';

/** Regex that every valid GroupName must satisfy. */
const GROUP_NAME_PATTERN = /^s[0-9]+$/i;

export interface WizardContractValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a DataContract before it is submitted to the backend compiler.
 *
 * Enforced invariants:
 *  1. Every SubDataMapping entry has a non-empty groupName.
 *  2. Every groupName matches s[0-9]+ (deterministic based on index).
 *  3. No groupName is duplicated.
 *  4. Every groupName that exists in SubDataMapping appears in at least one regex pattern
 *     (when patterns are present).
 */
export function validateWizardContract(
  contract: DataContract
): WizardContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const entries = Object.entries(contract.subDataMapping || {});

  // Only validate composite contracts (those with subtask mappings).
  if (entries.length === 0) {
    return { valid: true, errors, warnings };
  }

  // ✅ Extract patterns from contracts[] (not from contract.regex)
  const regexContracts = contract.contracts?.filter(c => c.type === 'regex') ?? [];
  const patterns: string[] = regexContracts.flatMap(c => (c as any).patterns ?? []);
  const combinedPattern = patterns.join('\n');

  // --- Extract named groups from all patterns ---
  const namedGroupPattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
  const regexGroups = new Set<string>();
  let match: RegExpExecArray | null;
  for (const p of patterns) {
    const re = new RegExp(namedGroupPattern.source, 'g');
    while ((match = re.exec(p)) !== null) {
      regexGroups.add(match[1]);
    }
  }

  const seenGroupNames = new Set<string>();

  for (const [subId, info] of entries) {
    // 1. groupName must be present
    if (!info.groupName) {
      errors.push(`SubDataMapping entry '${subId}' is missing groupName.`);
      continue;
    }

    // 2. groupName must match s[0-9]+ format
    if (!GROUP_NAME_PATTERN.test(info.groupName)) {
      errors.push(
        `SubDataMapping entry '${subId}' has invalid groupName '${info.groupName}'. ` +
        `Expected format: s[0-9]+ (e.g. s1, s2, s3).`
      );
    }

    // 3. groupName must not be duplicated
    if (seenGroupNames.has(info.groupName)) {
      errors.push(`Duplicate groupName '${info.groupName}' in SubDataMapping entry '${subId}'.`);
    } else {
      seenGroupNames.add(info.groupName);
    }

    // 4. groupName should appear in at least one pattern (when patterns are present)
    if (patterns.length > 0 && GROUP_NAME_PATTERN.test(info.groupName)) {
      if (!regexGroups.has(info.groupName)) {
        errors.push(
          `GroupName '${info.groupName}' for subtask '${subId}' is absent from all regex patterns.`
        );
      }
    }
  }

  // 6. Warn about any regex groups that are not in the mapping
  regexGroups.forEach(g => {
    if (!seenGroupNames.has(g)) {
      warnings.push(
        `Regex group '${g}' has no corresponding SubDataMapping entry.`
      );
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
