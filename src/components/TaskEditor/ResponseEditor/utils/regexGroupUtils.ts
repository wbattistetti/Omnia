// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { TaskTreeNode } from '@types/taskTypes';
import { deriveSubTaskKey } from '@utils/taskUtils';

/**
 * Get subTasks info (subTaskKey and label) from a node
 */
export function getSubTasksInfo(node: TaskTreeNode | null | undefined): Array<{ subTaskKey: string; label: string }> {
  if (!node) return [];

  // Use subNodes if available, otherwise fallback to subData/subSlots for backward compatibility
  const subNodes = node.subNodes || [];

  return subNodes.map((subNode) => {
    const subTaskKey = deriveSubTaskKey(subNode);
    return {
      subTaskKey,
      label: subNode.label || subNode.id || 'sub-data'
    };
  });
}

/**
 * Generate base regex with named groups for tasks with subTasks
 * Format: (?<subTaskKey1>...)?(?<subTaskKey2>...)?(?<subTaskKey3>...)?
 * All groups are optional because optionality is about user input, not task structure
 */
export function generateBaseRegexWithNamedGroups(subNodes: TaskTreeNode[]): string {
  if (subNodes.length === 0) {
    return '(.*)';
  }

  const groups = subNodes.map((subNode) => {
    const subTaskKey = deriveSubTaskKey(subNode);
    // Use placeholder pattern - AI or user will fill in the actual pattern
    return `(?<${subTaskKey}>.*)`;
  });

  return groups.join('');
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
  missingGroups: string[];  // subTaskKey that are missing in regex
  extraGroups: string[];     // groups in regex that don't match any subTaskKey
  mismatchedGroups: Array<{ expected: string; found: string }>;  // groups with wrong names
  errors: string[];
  warnings: string[];
}

/**
 * Validate that regex named groups match subTaskKeys from subNodes
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
    // No subTasks, regex doesn't need named groups
    result.valid = true;
    return result;
  }

  // Extract named groups from regex
  const regexGroups = extractNamedGroupsFromRegex(regex);
  result.groupsFound = regexGroups.length;

  // Get expected subTaskKeys
  const expectedKeys = subNodes.map(subNode => deriveSubTaskKey(subNode));

  // Find missing groups
  expectedKeys.forEach((expectedKey) => {
    if (!regexGroups.includes(expectedKey)) {
      result.missingGroups.push(expectedKey);
    }
  });

  // Find extra groups
  regexGroups.forEach((foundGroup) => {
    if (!expectedKeys.includes(foundGroup)) {
      result.extraGroups.push(foundGroup);
    }
  });

  // Validate group count
  if (result.missingGroups.length > 0) {
    result.valid = false;
    result.errors.push(
      `Missing named groups: ${result.missingGroups.join(', ')}. ` +
      `Expected groups: ${expectedKeys.join(', ')}`
    );
  }

  if (result.extraGroups.length > 0) {
    result.warnings.push(
      `Extra named groups found: ${result.extraGroups.join(', ')}. ` +
      `These groups don't match any subTask.`
    );
  }

  if (result.groupsFound < result.groupsExpected) {
    result.valid = false;
    result.errors.push(
      `Found ${result.groupsFound} named groups but need ${result.groupsExpected}. ` +
      `Missing: ${result.missingGroups.join(', ')}`
    );
  } else if (result.groupsFound > result.groupsExpected) {
    result.warnings.push(
      `Found ${result.groupsFound} named groups but only ${result.groupsExpected} subTasks expected. ` +
      `Extra groups: ${result.extraGroups.join(', ')}`
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
