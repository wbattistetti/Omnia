// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { generateSafeGuid } from '@utils/idGenerator';
import type { SemanticSlot, SemanticValue, SemanticSet } from '../../types/grammarTypes';

/**
 * Creates a new semantic slot
 * Pure function: no side effects, deterministic
 */
export function createSemanticSlot(
  name: string,
  type: SemanticSlot['type'] = 'string'
): SemanticSlot {
  return {
    id: generateSafeGuid(),
    name,
    type,
  };
}

/**
 * Creates a new semantic value
 * Pure function: no side effects, deterministic
 */
export function createSemanticValue(
  value: string,
  synonyms: string[] = []
): SemanticValue {
  return {
    id: generateSafeGuid(),
    value,
    synonyms,
  };
}

/**
 * Creates a new semantic set
 * Pure function: no side effects, deterministic
 */
export function createSemanticSet(
  name: string,
  values: SemanticValue[] = []
): SemanticSet {
  return {
    id: generateSafeGuid(),
    name,
    values,
  };
}

/**
 * Adds a value to a semantic set
 * Pure function: returns new set, does not mutate input
 */
export function addValueToSet(
  set: SemanticSet,
  value: SemanticValue
): SemanticSet {
  return {
    ...set,
    values: [...set.values, value],
  };
}

/**
 * Removes a value from a semantic set
 * Pure function: returns new set, does not mutate input
 */
export function removeValueFromSet(
  set: SemanticSet,
  valueId: string
): SemanticSet {
  return {
    ...set,
    values: set.values.filter(v => v.id !== valueId),
  };
}

/**
 * Adds a synonym to a semantic value
 * Pure function: returns new value, does not mutate input
 */
export function addSynonymToValue(
  value: SemanticValue,
  synonym: string
): SemanticValue {
  if (value.synonyms.includes(synonym)) {
    return value; // Idempotent
  }
  return {
    ...value,
    synonyms: [...value.synonyms, synonym],
  };
}

/**
 * Removes a synonym from a semantic value
 * Pure function: returns new value, does not mutate input
 */
export function removeSynonymFromValue(
  value: SemanticValue,
  synonym: string
): SemanticValue {
  return {
    ...value,
    synonyms: value.synonyms.filter(s => s !== synonym),
  };
}
