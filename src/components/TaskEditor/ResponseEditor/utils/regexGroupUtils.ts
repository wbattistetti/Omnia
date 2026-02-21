// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '@types/taskTypes';
import { deriveSubTaskKey } from '@utils/taskUtils';
import { getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';

/**
 * Generates a technical GUID-based regex group name.
 * Format: g_[a-f0-9]{12}
 * Neither canonicalKey nor label must ever appear as a regex group name.
 */
export function generateGroupName(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `g_${hex}`;
}

/** Regex that a valid GroupName must satisfy. */
export const GROUP_NAME_PATTERN = /^g_[a-f0-9]{12}$/i;

/**
 * Get subTasks info (subTaskKey and label) from a node
 */
export function getSubTasksInfo(node: TaskTreeNode | null | undefined): Array<{ subTaskKey: string; label: string }> {
  if (!node) return [];

  const subNodes = getSubNodesStrict(node);

  return subNodes.map((subNode) => {
    const subTaskKey = deriveSubTaskKey(subNode);
    return {
      subTaskKey,
      label: subNode.label || subNode.id || 'sub-data'
    };
  });
}

/**
 * Generate base regex with named groups for tasks with subTasks.
 * Uses GUID-based group names (g_[a-f0-9]{12}) — never canonicalKey or label.
 *
 * Returns both the generated regex string and the mapping of nodeId → groupName
 * so the caller can persist groupNames in SubDataMapping.
 *
 * Format: (?<g_xxxxxxxx...>.*)?(?<g_yyyyyyyy...>.*)?
 * All groups are optional because optionality is about user input, not task structure.
 */
export function generateBaseRegexWithNamedGroups(
  subNodes: TaskTreeNode[]
): { regex: string; groupNames: Record<string, string> } {
  if (subNodes.length === 0) {
    return { regex: '(.*)', groupNames: {} };
  }

  const groupNames: Record<string, string> = {};

  const groups = subNodes.map((subNode) => {
    const nodeKey = (subNode as any).id || (subNode as any).templateId || deriveSubTaskKey(subNode);
    const groupName = generateGroupName();
    groupNames[nodeKey] = groupName;
    // Use placeholder pattern - AI or user will fill in the actual pattern
    return `(?<${groupName}>.*)`;
  });

  return { regex: groups.join(''), groupNames };
}

/**
 * Generate base regex for simple tasks without subTasks
 * Uses kind-specific patterns if available, otherwise generic (.*)
 */
export function generateBaseRegexSimple(kind?: string): string {
  if (!kind) {
    return '(.*)';
  }

  // Kind-specific patterns (can be extended)
  const kindPatterns: Record<string, string> = {
    email: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    phone: '\\+?[0-9\\s\\-\\(\\)]{7,}',
    date: '\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?',
    number: '-?\\d+(?:[.,]\\d+)?',
    url: 'https?://[^\\s/$.?#].[^\\s]*',
  };

  return kindPatterns[kind.toLowerCase()] || '(.*)';
}

/**
 * Extract named groups from a regex string
 * Returns array of group names found in the regex
 */
export function extractNamedGroupsFromRegex(regex: string): string[] {
  if (!regex || !regex.trim()) {
    return [];
  }

  const namedGroupPattern = /\(\?<([a-zA-Z_][a-zA-Z0-9_]*)>/g;
  const groups: string[] = [];
  let match;

  while ((match = namedGroupPattern.exec(regex)) !== null) {
    groups.push(match[1]);
  }

  return groups;
}

/**
 * Validation result for named groups
 */
export interface NamedGroupsValidationResult {
  valid: boolean;
  groupsFound: number;
  groupsExpected: number;
  missingGroups: string[];  // groupNames missing from regex
  extraGroups: string[];    // groups in regex that don't match any SubDataMapping entry
  mismatchedGroups: Array<{ expected: string; found: string }>;
  errors: string[];
  warnings: string[];
}

/**
 * Validate that every SubDataMapping entry has a valid GUID groupName,
 * that every groupName appears in the regex, and that no canonicalKey
 * appears as a named group.
 *
 * @param regex         - The composite regex pattern.
 * @param subDataMapping - The SubDataMapping record from the contract.
 */
export function validateGroupNames(
  regex: string | undefined,
  subDataMapping: Record<string, { canonicalKey: string; groupName: string; label?: string; type?: string }>
): NamedGroupsValidationResult {
  const entries = Object.entries(subDataMapping);
  const result: NamedGroupsValidationResult = {
    valid: true,
    groupsFound: 0,
    groupsExpected: entries.length,
    missingGroups: [],
    extraGroups: [],
    mismatchedGroups: [],
    errors: [],
    warnings: []
  };

  if (!regex || !regex.trim()) {
    if (entries.length > 0) {
      result.valid = false;
      result.errors.push('Regex is empty but SubDataMapping has entries.');
    }
    return result;
  }

  const regexGroups = extractNamedGroupsFromRegex(regex);
  result.groupsFound = regexGroups.length;

  // 1. Every entry must have a valid GUID groupName
  for (const [subId, info] of entries) {
    if (!info.groupName) {
      result.valid = false;
      result.errors.push(`SubDataMapping entry '${subId}' is missing groupName.`);
      continue;
    }
    if (!GROUP_NAME_PATTERN.test(info.groupName)) {
      result.valid = false;
      result.errors.push(
        `SubDataMapping entry '${subId}' has invalid groupName '${info.groupName}'. ` +
        `Expected format: g_[a-f0-9]{12}.`
      );
    }
  }

  // 2. No duplicates in groupNames
  const groupNameSet = new Set<string>();
  for (const [subId, info] of entries) {
    if (info.groupName) {
      if (groupNameSet.has(info.groupName)) {
        result.valid = false;
        result.errors.push(`Duplicate groupName '${info.groupName}' in SubDataMapping entry '${subId}'.`);
      }
      groupNameSet.add(info.groupName);
    }
  }

  // 3. Every groupName must appear in the regex
  for (const [subId, info] of entries) {
    if (info.groupName && GROUP_NAME_PATTERN.test(info.groupName)) {
      if (!regexGroups.includes(info.groupName)) {
        result.valid = false;
        result.missingGroups.push(info.groupName);
        result.errors.push(
          `GroupName '${info.groupName}' for subtask '${subId}' is absent from the regex pattern.`
        );
      }
    }
  }

  // 4. No canonicalKey must appear as a named group in the regex
  for (const [subId, info] of entries) {
    if (info.canonicalKey && regexGroups.includes(info.canonicalKey)) {
      result.valid = false;
      result.errors.push(
        `canonicalKey '${info.canonicalKey}' for subtask '${subId}' appears as a named group in the regex. ` +
        `Only GUID groupNames (g_[a-f0-9]{12}) are allowed as group names.`
      );
    }
  }

  // 5. Extra groups in regex that have no mapping entry
  const knownGroupNames = new Set(entries.map(([, info]) => info.groupName).filter(Boolean));
  regexGroups.forEach((g) => {
    if (!knownGroupNames.has(g)) {
      result.extraGroups.push(g);
      result.warnings.push(
        `Regex group '${g}' has no corresponding SubDataMapping entry.`
      );
    }
  });

  return result;
}

/**
 * @deprecated Use validateGroupNames with SubDataMapping instead.
 * Validate that regex named groups match subTaskKeys from subNodes.
 * This legacy version validates against canonicalKey-derived names.
 */
export function validateNamedGroups(regex: string | undefined, subNodes: TaskTreeNode[]): NamedGroupsValidationResult {
  const result: NamedGroupsValidationResult = {
    valid: true,
    groupsFound: 0,
    groupsExpected: subNodes.length,
    missingGroups: [],
    extraGroups: [],
    mismatchedGroups: [],
    errors: [],
    warnings: []
  };

  if (!regex || !regex.trim()) {
    if (subNodes.length > 0) {
      result.valid = false;
      result.errors.push('Regex is empty but subTasks are present');
    }
    return result;
  }

  if (subNodes.length === 0) {
    result.valid = true;
    return result;
  }

  const regexGroups = extractNamedGroupsFromRegex(regex);
  result.groupsFound = regexGroups.length;

  // Validate all found groups conform to GUID format
  regexGroups.forEach((g) => {
    if (!GROUP_NAME_PATTERN.test(g)) {
      result.warnings.push(
        `Regex group '${g}' does not use GUID format (g_[a-f0-9]{12}). ` +
        `Consider migrating to generateGroupName().`
      );
    }
  });

  if (result.groupsFound < result.groupsExpected) {
    result.valid = false;
    result.errors.push(
      `Found ${result.groupsFound} named groups but need ${result.groupsExpected}.`
    );
  } else if (result.groupsFound > result.groupsExpected) {
    result.warnings.push(
      `Found ${result.groupsFound} named groups but only ${result.groupsExpected} subTasks expected.`
    );
  }

  return result;
}

/**
 * Map extracted groups from regex match to subTasks
 * Returns object with subTaskKey as keys and extracted values
 */
export function mapExtractedGroupsToSubTasks(
  groups: Record<string, string> | null | undefined,
  subNodes: TaskTreeNode[]
): Record<string, string> {
  const mapped: Record<string, string> = {};

  if (!groups || subNodes.length === 0) {
    return mapped;
  }

  subNodes.forEach((subNode) => {
    const subTaskKey = deriveSubTaskKey(subNode);
    if (groups[subTaskKey] !== undefined && groups[subTaskKey] !== null) {
      const value = String(groups[subTaskKey]).trim();
      if (value.length > 0) {
        mapped[subTaskKey] = value;
      }
    }
  });

  return mapped;
}
