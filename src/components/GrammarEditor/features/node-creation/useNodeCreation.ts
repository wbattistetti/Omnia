// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { useGrammarStore } from '../../core/state/grammarStore';
import { createGrammarNode } from '../../core/domain/node';
import { NODE_MIN_WIDTH, getNodeRight } from '../../components/GrammarNode';
import type { GrammarNode } from '../../types/grammarTypes';

/**
 * Hook for handling node creation
 * - Double click on canvas → create node
 * - ENTER on floating node → create next node to the right
 */
export function useNodeCreation() {
  const { addNode, grammar } = useGrammarStore();

  const createNodeAtPosition = useCallback((
    position: { x: number; y: number },
    label: string = ''
  ) => {
    const newNode = createGrammarNode(label, position);
    addNode(newNode);
    return newNode;
  }, [addNode]);

  /**
   * Creates a new empty node after a floating node.
   * Position: current node's right edge + w0 spacing
   * Only called when the current node is floating (new, no descendants).
   *
   * @param currentNode - The current node
   * @param currentLabel - Optional label to use for width calculation.
   *   If provided, uses this instead of currentNode.label (useful when label was just saved).
   */
  const createNodeAfterFloating = useCallback((
    currentNode: GrammarNode,
    currentLabel?: string
  ) => {
    if (!grammar) return null;

    // w0 = initial empty node width
    const w0 = NODE_MIN_WIDTH;

    // Calculate right edge of current node
    // Use provided label if available, otherwise use node.label
    const labelToUse = currentLabel !== undefined ? currentLabel : currentNode.label;
    const currentNodeRight = getNodeRight({
      position: currentNode.position,
      label: labelToUse,
    });

    // New node position: right edge + w0 spacing
    const newPosition = {
      x: currentNodeRight + w0,
      y: currentNode.position.y,
    };

    const newNode = createGrammarNode('', newPosition);
    addNode(newNode);
    return newNode;
  }, [grammar, addNode]);

  return {
    createNodeAtPosition,
    createNodeAfterFloating,
  };
}
