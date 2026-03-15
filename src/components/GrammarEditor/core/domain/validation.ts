// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Grammar, GrammarNode, GrammarEdge } from '../../types/grammarTypes';

/**
 * Validation error
 */
export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  nodeId?: string;
  edgeId?: string;
}

/**
 * Validates grammar structure
 * Pure function: no side effects
 */
export function validateGrammar(grammar: Grammar): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for empty grammar
  if (grammar.nodes.length === 0) {
    errors.push({
      type: 'warning',
      message: 'Grammar has no nodes',
    });
    return errors;
  }

  // Check for nodes with invalid semantic bindings
  grammar.nodes.forEach(node => {
    if (node.semanticType === 'value' && !node.semanticValueId) {
      errors.push({
        type: 'error',
        message: `Node "${node.label}" has semantic type 'value' but no semanticValueId`,
        nodeId: node.id,
      });
    }
    if (node.semanticType === 'set' && !node.semanticSetId) {
      errors.push({
        type: 'error',
        message: `Node "${node.label}" has semantic type 'set' but no semanticSetId`,
        nodeId: node.id,
      });
    }
    if (
      (node.semanticType === 'value' || node.semanticType === 'set') &&
      !node.slotId
    ) {
      errors.push({
        type: 'error',
        message: `Node "${node.label}" has semantic binding but no slotId`,
        nodeId: node.id,
      });
    }
  });

  // Check for edges with invalid node references
  grammar.edges.forEach(edge => {
    const sourceExists = grammar.nodes.some(n => n.id === edge.source);
    const targetExists = grammar.nodes.some(n => n.id === edge.target);

    if (!sourceExists) {
      errors.push({
        type: 'error',
        message: `Edge references non-existent source node: ${edge.source}`,
        edgeId: edge.id,
      });
    }
    if (!targetExists) {
      errors.push({
        type: 'error',
        message: `Edge references non-existent target node: ${edge.target}`,
        edgeId: edge.id,
      });
    }
  });

  // Check for disconnected nodes
  const connectedNodeIds = new Set<string>();
  grammar.edges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const disconnectedNodes = grammar.nodes.filter(
    n => !connectedNodeIds.has(n.id)
  );
  if (disconnectedNodes.length > 0 && grammar.nodes.length > 1) {
    errors.push({
      type: 'warning',
      message: `Found ${disconnectedNodes.length} disconnected node(s)`,
    });
  }

  // Check for duplicate node labels (warning only)
  const labelCounts = new Map<string, number>();
  grammar.nodes.forEach(node => {
    const count = labelCounts.get(node.label) || 0;
    labelCounts.set(node.label, count + 1);
  });
  labelCounts.forEach((count, label) => {
    if (count > 1) {
      errors.push({
        type: 'warning',
        message: `Duplicate node label: "${label}" (${count} occurrences)`,
      });
    }
  });

  return errors;
}

/**
 * Checks if grammar is valid (no errors, warnings allowed)
 * Pure function: no side effects
 */
export function isGrammarValid(grammar: Grammar): boolean {
  const errors = validateGrammar(grammar);
  return errors.every(e => e.type === 'warning');
}
