// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { v4 as uuidv4 } from 'uuid';
import type { GrammarNode, NodeBinding } from '../../types/grammarTypes';
import { validateSemanticBindingsVsNodeWords } from './semanticBindingsVsNodeWords';

/**
 * Validation result for bindings
 */
export interface BindingValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Creates a new grammar node
 * Pure function: no side effects, deterministic
 */
export function createGrammarNode(
  label: string,
  position: { x: number; y: number },
  bindings: NodeBinding[] = []
): GrammarNode {
  return {
    id: uuidv4(),
    label,
    synonyms: [],
    bindings,
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
): { node: GrammarNode; isValid: boolean; error?: string } {
  if (node.synonyms.includes(synonym)) {
    return { node, isValid: true }; // Idempotent
  }
  const candidate: GrammarNode = {
    ...node,
    synonyms: [...node.synonyms, synonym],
    updatedAt: Date.now(),
  };
  const vs = validateSemanticBindingsVsNodeWords(candidate);
  if (!vs.isValid) {
    return { node, isValid: false, error: vs.error };
  }
  return { node: candidate, isValid: true };
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
): { node: GrammarNode; isValid: boolean; error?: string } {
  const candidate: GrammarNode = {
    ...node,
    label,
    updatedAt: Date.now(),
  };
  const vs = validateSemanticBindingsVsNodeWords(candidate);
  if (!vs.isValid) {
    return { node, isValid: false, error: vs.error };
  }
  return { node: candidate, isValid: true };
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
 * Validates bindings according to constraints:
 * - Maximum one slot
 * - Either one or more semantic sets OR one semantic value (not both)
 * Pure function: no side effects
 */
export function validateBindings(bindings: NodeBinding[]): BindingValidationResult {
  const slots = bindings.filter(b => b.type === 'slot');
  const sets = bindings.filter(b => b.type === 'semantic-set');
  const values = bindings.filter(b => b.type === 'semantic-value');

  // Constraint 1: Maximum one slot
  if (slots.length > 1) {
    return {
      isValid: false,
      error: 'Only one slot binding allowed per node',
    };
  }

  // Constraint 2: Cannot have semantic sets AND semantic value together
  if (sets.length > 0 && values.length > 0) {
    return {
      isValid: false,
      error: 'Cannot have semantic sets and semantic value together. Use either sets or a single value.',
    };
  }

  // Constraint 3: Maximum one semantic value
  if (values.length > 1) {
    return {
      isValid: false,
      error: 'Only one semantic value binding allowed per node',
    };
  }

  return { isValid: true };
}

/**
 * Adds a binding to a node
 * Validates before adding and returns the updated node if valid
 * Pure function: returns new node, does not mutate input
 */
export function addBinding(
  node: GrammarNode,
  binding: NodeBinding
): { node: GrammarNode; isValid: boolean; error?: string } {
  // Check if binding already exists
  const exists = node.bindings.some(b => {
    if (b.type === binding.type) {
      if (binding.type === 'slot') {
        return b.slotId === binding.slotId;
      } else if (binding.type === 'semantic-set') {
        return b.setId === binding.setId;
      } else if (binding.type === 'semantic-value') {
        return b.valueId === binding.valueId;
      }
    }
    return false;
  });

  if (exists) {
    return { node, isValid: false, error: 'Binding already exists' };
  }

  // Create new bindings array with the new binding
  const newBindings = [...node.bindings, binding];

  // Validate
  const validation = validateBindings(newBindings);
  if (!validation.isValid) {
    return { node, isValid: false, error: validation.error };
  }

  const candidate: GrammarNode = {
    ...node,
    bindings: newBindings,
    updatedAt: Date.now(),
  };
  const vsWords = validateSemanticBindingsVsNodeWords(candidate);
  if (!vsWords.isValid) {
    return { node, isValid: false, error: vsWords.error };
  }

  return {
    node: candidate,
    isValid: true,
  };
}

/**
 * Removes a binding from a node
 * Pure function: returns new node, does not mutate input
 */
export function removeBinding(
  node: GrammarNode,
  bindingType: NodeBinding['type'],
  id: string
): GrammarNode {
  const newBindings = node.bindings.filter(b => {
    if (b.type === bindingType) {
      if (bindingType === 'slot') {
        return b.slotId !== id;
      } else if (bindingType === 'semantic-set') {
        return b.setId !== id;
      } else if (bindingType === 'semantic-value') {
        return b.valueId !== id;
      }
    }
    return true;
  });

  return {
    ...node,
    bindings: newBindings,
    updatedAt: Date.now(),
  };
}

/**
 * Removes all bindings of a specific type from a node
 * Pure function: returns new node, does not mutate input
 */
export function removeBindingsByType(
  node: GrammarNode,
  bindingType: NodeBinding['type']
): GrammarNode {
  return {
    ...node,
    bindings: node.bindings.filter(b => b.type !== bindingType),
    updatedAt: Date.now(),
  };
}

/**
 * Removes all bindings from a node
 * Pure function: returns new node, does not mutate input
 */
export function clearBindings(node: GrammarNode): GrammarNode {
  return {
    ...node,
    bindings: [],
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
