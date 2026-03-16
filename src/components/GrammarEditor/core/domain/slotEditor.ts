// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { SemanticSlot, SemanticSet, SemanticValue } from '../../types/grammarTypes';
import type { TreeNode, ValidationResult, SynonymSuggestion } from '../../types/slotEditorTypes';

/**
 * Normalizes a string input (trim, lowercase, remove accents)
 */
export function normalizeInput(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Normalizes for comparison (more aggressive)
 */
export function normalizeForComparison(input: string): string {
  return normalizeInput(input)
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Validates slot name (no duplicates, valid format)
 */
export function validateSlotName(
  name: string,
  existingSlots: SemanticSlot[],
  excludeId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const normalized = normalizeInput(name);

  if (!name || name.trim().length === 0) {
    errors.push('Slot name cannot be empty');
    return { isValid: false, errors, warnings, suggestions };
  }

  if (name.length < 2) {
    errors.push('Slot name must be at least 2 characters');
  }

  if (name.length > 50) {
    errors.push('Slot name must be less than 50 characters');
  }

  // Check for duplicates (case-insensitive, normalized)
  const duplicate = existingSlots.find(
    (slot) =>
      slot.id !== excludeId &&
      normalizeForComparison(slot.name) === normalizeForComparison(name)
  );

  if (duplicate) {
    errors.push(`Slot "${duplicate.name}" already exists`);
  }

  // Check format (should be alphanumeric with underscores)
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    warnings.push('Slot name should start with a letter and contain only letters, numbers, and underscores');
    suggestions.push(name.replace(/[^a-zA-Z0-9_]/g, '_'));
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Validates semantic set name
 */
export function validateSemanticSetName(
  name: string,
  existingSets: SemanticSet[],
  excludeId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!name || name.trim().length === 0) {
    errors.push('Semantic set name cannot be empty');
    return { isValid: false, errors, warnings, suggestions };
  }

  if (name.length < 2) {
    errors.push('Semantic set name must be at least 2 characters');
  }

  // Check for duplicates
  const duplicate = existingSets.find(
    (set) =>
      set.id !== excludeId &&
      normalizeForComparison(set.name) === normalizeForComparison(name)
  );

  if (duplicate) {
    errors.push(`Semantic set "${duplicate.name}" already exists`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Validates semantic value
 */
export function validateSemanticValue(
  value: string,
  existingValues: SemanticValue[],
  excludeId?: string
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!value || value.trim().length === 0) {
    errors.push('Semantic value cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Check for duplicates
  const duplicate = existingValues.find(
    (v) =>
      v.id !== excludeId &&
      normalizeForComparison(v.value) === normalizeForComparison(value)
  );

  if (duplicate) {
    errors.push(`Semantic value "${duplicate.value}" already exists`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates linguistic value (synonym)
 */
export function validateLinguisticValue(
  synonym: string,
  existingSynonyms: string[],
  excludeIndex?: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!synonym || synonym.trim().length === 0) {
    errors.push('Linguistic value cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Check for duplicates (case-insensitive)
  const normalized = normalizeForComparison(synonym);
  const duplicateIndex = existingSynonyms.findIndex(
    (s, idx) => idx !== excludeIndex && normalizeForComparison(s) === normalized
  );

  if (duplicateIndex !== -1) {
    errors.push(`Synonym "${existingSynonyms[duplicateIndex]}" already exists`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Suggests synonyms based on similarity and patterns
 */
export function suggestSynonyms(
  value: string,
  existingValues: SemanticValue[],
  maxSuggestions: number = 5
): SynonymSuggestion[] {
  const suggestions: SynonymSuggestion[] = [];
  const normalized = normalizeForComparison(value);

  // Pattern-based suggestions
  const patterns: Array<{ pattern: RegExp; replacement: string; confidence: number }> = [
    { pattern: /^(.*)\.$/, replacement: '$1', confidence: 0.7 }, // Remove trailing dot
    { pattern: /^\.(.*)$/, replacement: '$1', confidence: 0.7 }, // Remove leading dot
    { pattern: /^the\s+(.*)$/i, replacement: '$1', confidence: 0.6 }, // Remove "the"
    { pattern: /^(.*)\s+the$/i, replacement: '$1', confidence: 0.6 }, // Remove trailing "the"
  ];

  for (const { pattern, replacement, confidence } of patterns) {
    const suggested = value.replace(pattern, replacement).trim();
    if (suggested !== value && suggested.length > 0) {
      suggestions.push({
        value: suggested,
        confidence,
        source: 'pattern',
      });
    }
  }

  // Similarity-based suggestions (simple Levenshtein-like)
  for (const existing of existingValues) {
    if (existing.value.toLowerCase() === value.toLowerCase()) continue;

    const similarity = calculateSimilarity(normalized, normalizeForComparison(existing.value));
    if (similarity > 0.6) {
      suggestions.push({
        value: existing.value,
        confidence: similarity,
        source: 'similarity',
      });
    }
  }

  // Sort by confidence and return top N
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxSuggestions);
}

/**
 * Simple similarity calculation (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Builds tree structure from slots and sets (alphabetically sorted)
 * Always creates both section headers, even when empty, so users can add items.
 */
export function buildTreeStructure(
  slots: SemanticSlot[],
  semanticSets: SemanticSet[]
): TreeNode[] {
  // Sort slots alphabetically
  const sortedSlots = [...slots].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  // Sort semantic sets alphabetically
  const sortedSets = [...semanticSets].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  // === Slots section (always present, comes first) ===
  const slotsSection: TreeNode = {
    id: 'slots-section',
    type: 'slot',
    label: 'Slots',
    data: null,
    level: 0,
    children: sortedSlots.map((slot) => ({
      id: `slot-${slot.id}`,
      type: 'slot' as const,
      label: slot.name,
      data: slot,
      level: 1,
      parentId: 'slots-section',
      children: [],
    })),
  };

  // === Semantic Sets section (always present, comes second) ===
  const setsSection: TreeNode = {
    id: 'semantic-sets-section',
    type: 'semantic-set',
    label: 'Semantic Sets',
    data: null,
    level: 0,
    children: sortedSets.map((set) => {
      // Sort semantic values alphabetically
      const sortedValues = [...set.values].sort((a, b) =>
        a.value.localeCompare(b.value, undefined, { sensitivity: 'base' })
      );

      const setNode: TreeNode = {
        id: `set-${set.id}`,
        type: 'semantic-set',
        label: set.name,
        data: set,
        level: 1,
        parentId: 'semantic-sets-section',
        children: sortedValues.map((value) => {
          // Sort linguistic values (synonyms) alphabetically
          const sortedSynonyms = [...value.synonyms].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
          );

          const valueNode: TreeNode = {
            id: `value-${value.id}`,
            type: 'semantic-value',
            label: value.value,
            data: value,
            level: 2,
            parentId: `set-${set.id}`,
            children: sortedSynonyms.map((synonym) => ({
              id: `synonym-${value.id}-${synonym}`,
              type: 'linguistic-value' as const,
              label: synonym,
              data: synonym,
              level: 3,
              parentId: `value-${value.id}`,
            })),
          };
          return valueNode;
        }),
      };
      return setNode;
    }),
  };

  return [slotsSection, setsSection];
}

/**
 * Finds a node by ID in the tree
 */
export function findNodeById(tree: TreeNode[], id: string): TreeNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}
