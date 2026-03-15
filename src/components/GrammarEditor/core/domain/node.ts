// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { v4 as uuidv4 } from 'uuid';
import type { GrammarNode } from '../../types/grammarTypes';

/**
 * Creates a new grammar node
 * Pure function: no side effects, deterministic
 */
export function createGrammarNode(
  label: string,
  position: { x: number; y: number }
): GrammarNode {
  return {
    id: uuidv4(),
    label,
    synonyms: [],
    semanticType: 'none',
    optional: false,
    repeatable: false,
    position,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Adds a synonym to a node
 * Pure function: returns new node, does not mutate input
 */
export function addSynonym(
  node: GrammarNode,
  synonym: string
): GrammarNode {
  if (node.synonyms.includes(synonym)) {
    return node; // Idempotent
  }
  return {
    ...node,
    synonyms: [...node.synonyms, synonym],
    updatedAt: Date.now(),
  };
}

/**
 * Removes a synonym from a node
 * Pure function: returns new node, does not mutate input
 */
export function removeSynonym(
  node: GrammarNode,
  synonym: string
): GrammarNode {
  return {
    ...node,
    synonyms: node.synonyms.filter(s => s !== synonym),
    updatedAt: Date.now(),
  };
}

/**
 * Updates node label
 * Pure function: returns new node, does not mutate input
 */
export function updateNodeLabel(
  node: GrammarNode,
  label: string
): GrammarNode {
  return {
    ...node,
    label,
    updatedAt: Date.now(),
  };
}

/**
 * Updates node regex pattern
 * Pure function: returns new node, does not mutate input
 */
export function updateNodeRegex(
  node: GrammarNode,
  regex: string | undefined
): GrammarNode {
  return {
    ...node,
    regex,
    updatedAt: Date.now(),
  };
}

/**
 * Binds semantic value to a node
 * Pure function: returns new node, does not mutate input
 */
export function bindSemanticValue(
  node: GrammarNode,
  valueId: string,
  slotId: string
): GrammarNode {
  return {
    ...node,
    semanticType: 'value',
    semanticValueId: valueId,
    slotId,
    updatedAt: Date.now(),
  };
}

/**
 * Binds semantic set to a node
 * Pure function: returns new node, does not mutate input
 */
export function bindSemanticSet(
  node: GrammarNode,
  setId: string,
  slotId: string
): GrammarNode {
  return {
    ...node,
    semanticType: 'set',
    semanticSetId: setId,
    slotId,
    updatedAt: Date.now(),
  };
}

/**
 * Removes semantic binding from a node
 * Pure function: returns new node, does not mutate input
 */
export function unbindSemantic(node: GrammarNode): GrammarNode {
  return {
    ...node,
    semanticType: 'none',
    semanticValueId: undefined,
    semanticSetId: undefined,
    slotId: undefined,
    updatedAt: Date.now(),
  };
}

/**
 * Sets node as optional
 * Pure function: returns new node, does not mutate input
 */
export function setNodeOptional(
  node: GrammarNode,
  optional: boolean
): GrammarNode {
  return {
    ...node,
    optional,
    updatedAt: Date.now(),
  };
}

/**
 * Sets node as repeatable
 * Pure function: returns new node, does not mutate input
 */
export function setNodeRepeatable(
  node: GrammarNode,
  repeatable: boolean
): GrammarNode {
  return {
    ...node,
    repeatable,
    updatedAt: Date.now(),
  };
}

/**
 * Updates node position
 * Pure function: returns new node, does not mutate input
 */
export function updateNodePosition(
  node: GrammarNode,
  position: { x: number; y: number }
): GrammarNode {
  return {
    ...node,
    position,
    updatedAt: Date.now(),
  };
}
