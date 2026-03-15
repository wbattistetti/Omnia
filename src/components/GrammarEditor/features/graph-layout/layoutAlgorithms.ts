// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import type { Grammar, GrammarNode } from '../../types/grammarTypes';

/**
 * Simple horizontal layout algorithm
 * Arranges nodes in a horizontal line with spacing
 */
export function horizontalLayout(
  nodes: GrammarNode[],
  startX: number = 0,
  startY: number = 0,
  spacing: number = 200
): GrammarNode[] {
  return nodes.map((node, index) => ({
    ...node,
    position: {
      x: startX + index * spacing,
      y: startY,
    },
  }));
}

/**
 * Hierarchical layout algorithm (topological sort)
 * Arranges nodes in levels based on graph structure
 */
export function hierarchicalLayout(
  grammar: Grammar,
  startX: number = 0,
  startY: number = 0,
  levelSpacing: number = 300,
  nodeSpacing: number = 200
): GrammarNode[] {
  const { nodes, edges } = grammar;

  // Build adjacency list
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();

  nodes.forEach(node => {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  });

  edges.forEach(edge => {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
  });

  // Topological sort to determine levels
  const levels: string[][] = [];
  const processed = new Set<string>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    inDegree.set(node.id, incoming.get(node.id)?.length || 0);
  });

  let currentLevel: string[] = [];
  nodes.forEach(node => {
    if (inDegree.get(node.id) === 0) {
      currentLevel.push(node.id);
    }
  });

  while (currentLevel.length > 0) {
    levels.push([...currentLevel]);
    const nextLevel: string[] = [];

    currentLevel.forEach(nodeId => {
      processed.add(nodeId);
      outgoing.get(nodeId)?.forEach(targetId => {
        const currentInDegree = inDegree.get(targetId) || 0;
        inDegree.set(targetId, currentInDegree - 1);
        if (currentInDegree - 1 === 0 && !processed.has(targetId)) {
          nextLevel.push(targetId);
        }
      });
    });

    currentLevel = nextLevel;
  }

  // Position nodes based on levels
  const positionedNodes = new Map<string, GrammarNode>();

  levels.forEach((level, levelIndex) => {
    level.forEach((nodeId, nodeIndex) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        positionedNodes.set(nodeId, {
          ...node,
          position: {
            x: startX + levelIndex * levelSpacing,
            y: startY + nodeIndex * nodeSpacing,
          },
        });
      }
    });
  });

  // Return all nodes with updated positions
  return nodes.map(node => positionedNodes.get(node.id) || node);
}
