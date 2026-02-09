// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { WizardTaskTreeNode } from '../types';

/**
 * Normalize task label (remove common prefixes)
 */
function normalizeTaskLabel(taskLabel: string): string {
  let normalized = taskLabel.trim();

  // Remove common Italian prefixes
  normalized = normalized.replace(/^(chiedi|richiedi|inserisci|fornisci|inserire|fornire)\s+/i, '');

  // Remove common English prefixes
  normalized = normalized.replace(/^(ask for|request|enter|provide|insert)\s+/i, '');

  // If empty after normalization, use original text
  if (!normalized || normalized.trim() === '') {
    normalized = taskLabel.trim();
  }

  return normalized;
}

/**
 * Generate readable name for a node
 *
 * Rules:
 * - Main node (single): readableName = normalizedTaskLabel
 * - Main node (multiple): readableName = normalizedTaskLabel.mainLabel
 * - Sub node: readableName = mainReadableName.subLabel (complete, not hierarchical)
 *
 * Examples:
 * - Main "Data di nascita" (single): "Data di nascita del paziente"
 * - Sub "Giorno": "Giorno di nascita del paziente" (complete, not "Data di nascita del paziente.Giorno")
 */
function generateReadableName(
  node: WizardTaskTreeNode,
  normalizedTaskLabel: string,
  hasMultipleMains: boolean,
  parentReadableName?: string
): string {
  // Sub node: complete name (not hierarchical)
  if (parentReadableName) {
    return `${node.label} di ${normalizedTaskLabel}`;
  }

  // Main node: check if multiple mains
  if (hasMultipleMains) {
    return `${normalizedTaskLabel}.${node.label}`;
  }

  // Main node (single): just normalized task label
  return normalizedTaskLabel;
}

/**
 * Generate dotted name for a node (hierarchical format)
 *
 * Rules:
 * - Main node: dottedName = normalizedTaskLabel
 * - Sub node: dottedName = parentDottedName.subLabel
 *
 * Examples:
 * - Main "Data di nascita": "Data di nascita del paziente"
 * - Sub "Giorno": "Data di nascita del paziente.Giorno"
 */
function generateDottedName(
  node: WizardTaskTreeNode,
  normalizedTaskLabel: string,
  hasMultipleMains: boolean,
  parentDottedName?: string
): string {
  // Sub node: hierarchical format
  if (parentDottedName) {
    return `${parentDottedName}.${node.label}`;
  }

  // Main node: check if multiple mains
  if (hasMultipleMains) {
    return `${normalizedTaskLabel}.${node.label}`;
  }

  // Main node (single): just normalized task label
  return normalizedTaskLabel;
}

/**
 * Check if structure has multiple main nodes
 */
function hasMultipleMains(structure: WizardTaskTreeNode[]): boolean {
  return structure.length > 1;
}

/**
 * Generate variable names (readableName and dottedName) for all nodes in structure
 *
 * @param structure Array of WizardTaskTreeNode (root nodes)
 * @param taskLabel Original task label (e.g., "Chiedi la data di nascita")
 * @param existingVariables Optional: existing variable names to avoid duplicates
 * @returns Map of nodeId → { readableName, dottedName }
 */
export function generateVariableNames(
  structure: WizardTaskTreeNode[],
  taskLabel: string,
  existingVariables?: string[]
): Map<string, { readableName: string; dottedName: string }> {
  const result = new Map<string, { readableName: string; dottedName: string }>();
  const normalizedTaskLabel = normalizeTaskLabel(taskLabel);
  const hasMultiple = hasMultipleMains(structure);

  // Track used names to avoid duplicates
  const usedNames = new Set<string>(existingVariables || []);

  /**
   * Process node recursively
   */
  function processNode(
    node: WizardTaskTreeNode,
    parentReadableName?: string,
    parentDottedName?: string
  ): void {
    // Generate names
    let readableName = generateReadableName(node, normalizedTaskLabel, hasMultiple, parentReadableName);
    let dottedName = generateDottedName(node, normalizedTaskLabel, hasMultiple, parentDottedName);

    // Avoid duplicates: append suffix if needed
    let readableSuffix = 1;
    let originalReadableName = readableName;
    while (usedNames.has(readableName)) {
      readableName = `${originalReadableName}_${readableSuffix}`;
      readableSuffix++;
    }
    usedNames.add(readableName);

    // Store result
    result.set(node.id, { readableName, dottedName });

    // Process children recursively
    if (node.subNodes && node.subNodes.length > 0) {
      node.subNodes.forEach((subNode) => {
        processNode(subNode, readableName, dottedName);
      });
    }
  }

  // Process all root nodes
  structure.forEach((node) => {
    processNode(node);
  });

  return result;
}

/**
 * Apply generated variable names to structure (mutates nodes)
 *
 * @param structure Array of WizardTaskTreeNode
 * @param variableNames Map of nodeId → { readableName, dottedName }
 * @param taskId Task ID to assign to all nodes
 */
export function applyVariableNamesToStructure(
  structure: WizardTaskTreeNode[],
  variableNames: Map<string, { readableName: string; dottedName: string }>,
  taskId: string
): void {
  function applyToNode(node: WizardTaskTreeNode): void {
    const names = variableNames.get(node.id);
    if (names) {
      node.readableName = names.readableName;
      node.dottedName = names.dottedName;
      node.taskId = taskId;
    }

    // Apply recursively to children
    if (node.subNodes && node.subNodes.length > 0) {
      node.subNodes.forEach(applyToNode);
    }
  }

  structure.forEach(applyToNode);
}
