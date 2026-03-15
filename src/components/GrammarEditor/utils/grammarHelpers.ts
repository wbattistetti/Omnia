// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Grammar, GrammarNode, GrammarEdge } from '../types/grammarTypes';

/**
 * Helper functions for grammar operations
 */

/**
 * Finds all nodes reachable from a given node
 */
export function getReachableNodes(
  grammar: Grammar,
  startNodeId: string
): GrammarNode[] {
  const visited = new Set<string>();
  const result: GrammarNode[] = [];

  function traverse(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = grammar.nodes.find(n => n.id === nodeId);
    if (node) {
      result.push(node);

      // Traverse outgoing edges
      grammar.edges
        .filter(e => e.source === nodeId)
        .forEach(e => traverse(e.target));
    }
  }

  traverse(startNodeId);
  return result;
}

/**
 * Checks if grammar has cycles
 */
export function hasCycles(grammar: Grammar): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    if (recStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recStack.add(nodeId);

    const hasCycleInChildren = grammar.edges
      .filter(e => e.source === nodeId)
      .some(e => hasCycle(e.target));

    recStack.delete(nodeId);
    return hasCycleInChildren;
  }

  return grammar.nodes.some(node => hasCycle(node.id));
}

/**
 * Gets all paths from start to end node
 */
export function getAllPaths(
  grammar: Grammar,
  startNodeId: string,
  endNodeId: string
): GrammarNode[][] {
  const paths: GrammarNode[][] = [];
  const currentPath: GrammarNode[] = [];

  function findPaths(nodeId: string) {
    const node = grammar.nodes.find(n => n.id === nodeId);
    if (!node) return;

    currentPath.push(node);

    if (nodeId === endNodeId) {
      paths.push([...currentPath]);
    } else {
      grammar.edges
        .filter(e => e.source === nodeId)
        .forEach(e => findPaths(e.target));
    }

    currentPath.pop();
  }

  findPaths(startNodeId);
  return paths;
}

/**
 * Calculates graph statistics
 */
export function getGraphStats(grammar: Grammar) {
  return {
    nodeCount: grammar.nodes.length,
    edgeCount: grammar.edges.length,
    slotCount: grammar.slots.length,
    semanticSetCount: grammar.semanticSets.length,
    hasCycles: hasCycles(grammar),
    entryNodes: grammar.nodes.filter(n =>
      !grammar.edges.some(e => e.target === n.id)
    ).length,
  };
}
