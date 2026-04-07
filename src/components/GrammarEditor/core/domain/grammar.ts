// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { generateSafeGuid } from '@utils/idGenerator';
import type { Grammar, GrammarNode, GrammarEdge } from '../../types/grammarTypes';

/**
 * Creates a new empty grammar
 * Pure function: no side effects, deterministic
 */
export function createGrammar(name: string): Grammar {
  return {
    id: generateSafeGuid(),
    name,
    nodes: [],
    edges: [],
    slots: [],
    semanticSets: [],
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
    },
  };
}

/**
 * Adds a node to grammar
 * Pure function: returns new grammar, does not mutate input
 */
export function addNodeToGrammar(
  grammar: Grammar,
  node: GrammarNode
): Grammar {
  return {
    ...grammar,
    nodes: [...grammar.nodes, node],
    metadata: {
      ...grammar.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Removes a node from grammar
 * Pure function: returns new grammar, does not mutate input
 * Also removes all edges connected to the node
 */
export function removeNodeFromGrammar(
  grammar: Grammar,
  nodeId: string
): Grammar {
  return {
    ...grammar,
    nodes: grammar.nodes.filter(n => n.id !== nodeId),
    edges: grammar.edges.filter(
      e => e.source !== nodeId && e.target !== nodeId
    ),
    metadata: {
      ...grammar.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Updates a node in grammar
 * Pure function: returns new grammar, does not mutate input
 */
export function updateNodeInGrammar(
  grammar: Grammar,
  nodeId: string,
  updates: Partial<GrammarNode>
): Grammar {
  return {
    ...grammar,
    nodes: grammar.nodes.map(n =>
      n.id === nodeId ? { ...n, ...updates, updatedAt: Date.now() } : n
    ),
    metadata: {
      ...grammar.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Adds an edge to grammar
 * Pure function: returns new grammar, does not mutate input
 */
export function addEdgeToGrammar(
  grammar: Grammar,
  edge: GrammarEdge
): Grammar {
  return {
    ...grammar,
    edges: [...grammar.edges, edge],
    metadata: {
      ...grammar.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Removes an edge from grammar
 * Pure function: returns new grammar, does not mutate input
 */
export function removeEdgeFromGrammar(
  grammar: Grammar,
  edgeId: string
): Grammar {
  return {
    ...grammar,
    edges: grammar.edges.filter(e => e.id !== edgeId),
    metadata: {
      ...grammar.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Updates an edge in grammar
 * Pure function: returns new grammar, does not mutate input
 */
export function updateEdgeInGrammar(
  grammar: Grammar,
  edgeId: string,
  updates: Partial<GrammarEdge>
): Grammar {
  return {
    ...grammar,
    edges: grammar.edges.map(e =>
      e.id === edgeId ? { ...e, ...updates } : e
    ),
    metadata: {
      ...grammar.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Gets node by ID
 * Pure function: no side effects
 */
export function getNodeById(
  grammar: Grammar,
  nodeId: string
): GrammarNode | undefined {
  return grammar.nodes.find(n => n.id === nodeId);
}

/**
 * Gets edge by ID
 * Pure function: no side effects
 */
export function getEdgeById(
  grammar: Grammar,
  edgeId: string
): GrammarEdge | undefined {
  return grammar.edges.find(e => e.id === edgeId);
}

/**
 * Gets all edges connected to a node
 * Pure function: no side effects
 */
export function getNodeEdges(
  grammar: Grammar,
  nodeId: string
): GrammarEdge[] {
  return grammar.edges.filter(
    e => e.source === nodeId || e.target === nodeId
  );
}

/**
 * Gets outgoing edges from a node
 * Pure function: no side effects
 */
export function getOutgoingEdges(
  grammar: Grammar,
  nodeId: string
): GrammarEdge[] {
  return grammar.edges.filter(e => e.source === nodeId);
}

/**
 * Gets incoming edges to a node
 * Pure function: no side effects
 */
export function getIncomingEdges(
  grammar: Grammar,
  nodeId: string
): GrammarEdge[] {
  return grammar.edges.filter(e => e.target === nodeId);
}

/**
 * Gets entry nodes (nodes with no incoming edges)
 * Pure function: no side effects
 */
export function getEntryNodes(grammar: Grammar): GrammarNode[] {
  const incomingNodeIds = new Set(
    grammar.edges.map(e => e.target)
  );
  return grammar.nodes.filter(n => !incomingNodeIds.has(n.id));
}

/**
 * Checks if a node has any outgoing edges (descendants).
 * Pure function: no side effects
 */
export function hasDescendants(
  grammar: Grammar,
  nodeId: string
): boolean {
  const outgoingEdges = getOutgoingEdges(grammar, nodeId);
  return outgoingEdges.length > 0;
}

/**
 * Checks if a node is "floating" (newly created, not yet stabilized).
 * A node is floating if:
 * - It has no label (empty) OR is currently being edited with empty value
 * - It has no outgoing edges (no descendants)
 * Pure function: no side effects
 *
 * @param currentEditValue - Optional current edit value (from input field).
 *   If provided, uses this instead of node.label to determine if node is empty.
 */
export function isFloatingNode(
  grammar: Grammar,
  node: GrammarNode,
  isCurrentlyEditing: boolean,
  currentEditValue?: string
): boolean {
  // Use current edit value if provided and editing, otherwise use saved label
  const effectiveLabel = (isCurrentlyEditing && currentEditValue !== undefined)
    ? currentEditValue.trim()
    : node.label;

  // Node is floating if it's empty or being edited
  const isEmptyOrEditing = !effectiveLabel || isCurrentlyEditing;

  // Node is floating if it has no descendants
  const hasNoDescendants = !hasDescendants(grammar, node.id);

  return isEmptyOrEditing && hasNoDescendants;
}
