// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGrammarStore } from '../../core/state/grammarStore';
import {
  createSemanticSlot,
  createSemanticSet,
  createSemanticValue,
  addValueToSet,
  addSynonymToValue,
} from '../../core/domain/semantic';
import {
  validateSlotName,
  validateSemanticSetName,
  validateSemanticValue,
  validateLinguisticValue,
  normalizeInput,
} from '../../core/domain/slotEditor';
import type { Operation } from '../../types/slotEditorTypes';
import type { SemanticSlot, SemanticSet, SemanticValue } from '../../types/grammarTypes';

/**
 * Hook for CRUD operations on slots, sets, and values
 * Single Responsibility: Business logic for slot editor actions
 */
export function useSlotEditorActions(
  recordOperation: (op: Operation) => void
) {
  const {
    grammar,
    addSlot,
    updateSlot,
    deleteSlot,
    addSemanticSet,
    updateSemanticSet,
    deleteSemanticSet,
  } = useGrammarStore();

  /**
   * Creates a new slot with validation
   */
  const createSlot = useCallback(
    (name: string, type: SemanticSlot['type'] = 'string'): { success: boolean; error?: string; slot?: SemanticSlot } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const validation = validateSlotName(name, grammar.slots);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const normalizedName = normalizeInput(name);
      const slot = createSemanticSlot(normalizedName, type);

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'add',
        entityType: 'slot',
        entityId: slot.id,
        previousState: null,
        newState: slot,
        timestamp: Date.now(),
      });

      addSlot(slot);
      return { success: true, slot };
    },
    [grammar, addSlot, recordOperation]
  );

  /**
   * Updates a slot with validation
   */
  const updateSlotName = useCallback(
    (slotId: string, newName: string): { success: boolean; error?: string } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const slot = grammar.slots.find((s) => s.id === slotId);
      if (!slot) {
        return { success: false, error: 'Slot not found' };
      }

      const validation = validateSlotName(newName, grammar.slots, slotId);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const normalizedName = normalizeInput(newName);

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'update',
        entityType: 'slot',
        entityId: slotId,
        previousState: slot,
        newState: { ...slot, name: normalizedName },
        timestamp: Date.now(),
      });

      updateSlot(slotId, { name: normalizedName });
      return { success: true };
    },
    [grammar, updateSlot, recordOperation]
  );

  /**
   * Deletes a slot
   */
  const removeSlot = useCallback(
    (slotId: string): { success: boolean; error?: string } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const slot = grammar.slots.find((s) => s.id === slotId);
      if (!slot) {
        return { success: false, error: 'Slot not found' };
      }

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'delete',
        entityType: 'slot',
        entityId: slotId,
        previousState: slot,
        newState: null,
        timestamp: Date.now(),
      });

      deleteSlot(slotId);
      return { success: true };
    },
    [grammar, deleteSlot, recordOperation]
  );

  /**
   * Creates a new semantic set with validation
   */
  const createSemanticSetAction = useCallback(
    (name: string): { success: boolean; error?: string; set?: SemanticSet } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const validation = validateSemanticSetName(name, grammar.semanticSets);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const normalizedName = normalizeInput(name);
      const set = createSemanticSet(normalizedName);

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'add',
        entityType: 'semantic-set',
        entityId: set.id,
        previousState: null,
        newState: set,
        timestamp: Date.now(),
      });

      addSemanticSet(set);
      return { success: true, set };
    },
    [grammar, addSemanticSet, recordOperation]
  );

  /**
   * Updates a semantic set name with validation
   */
  const updateSemanticSetName = useCallback(
    (setId: string, newName: string): { success: boolean; error?: string } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const set = grammar.semanticSets.find((s) => s.id === setId);
      if (!set) {
        return { success: false, error: 'Semantic set not found' };
      }

      const validation = validateSemanticSetName(newName, grammar.semanticSets, setId);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const normalizedName = normalizeInput(newName);

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'update',
        entityType: 'semantic-set',
        entityId: setId,
        previousState: set,
        newState: { ...set, name: normalizedName },
        timestamp: Date.now(),
      });

      updateSemanticSet(setId, { name: normalizedName });
      return { success: true };
    },
    [grammar, updateSemanticSet, recordOperation]
  );

  /**
   * Deletes a semantic set
   */
  const removeSemanticSet = useCallback(
    (setId: string): { success: boolean; error?: string } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const set = grammar.semanticSets.find((s) => s.id === setId);
      if (!set) {
        return { success: false, error: 'Semantic set not found' };
      }

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'delete',
        entityType: 'semantic-set',
        entityId: setId,
        previousState: set,
        newState: null,
        timestamp: Date.now(),
      });

      deleteSemanticSet(setId);
      return { success: true };
    },
    [grammar, deleteSemanticSet, recordOperation]
  );

  /**
   * Adds a semantic value to a set with validation
   */
  const addSemanticValue = useCallback(
    (setId: string, value: string): { success: boolean; error?: string; semanticValue?: SemanticValue } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const set = grammar.semanticSets.find((s) => s.id === setId);
      if (!set) {
        return { success: false, error: 'Semantic set not found' };
      }

      const validation = validateSemanticValue(value, set.values);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const normalizedValue = normalizeInput(value);
      // Create semantic value with the value itself as the first linguistic value (synonym)
      // This ensures every semantic value has at least one linguistic value
      const semanticValue = createSemanticValue(normalizedValue, [normalizedValue]);

      const updatedSet = addValueToSet(set, semanticValue);

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'update',
        entityType: 'semantic-set',
        entityId: setId,
        previousState: set,
        newState: updatedSet,
        timestamp: Date.now(),
      });

      updateSemanticSet(setId, { values: updatedSet.values });
      return { success: true, semanticValue };
    },
    [grammar, updateSemanticSet, recordOperation]
  );

  /**
   * Adds a linguistic value (synonym) to a semantic value with validation
   */
  const addLinguisticValue = useCallback(
    (setId: string, valueId: string, synonym: string): { success: boolean; error?: string } => {
      if (!grammar) {
        return { success: false, error: 'No grammar loaded' };
      }

      const set = grammar.semanticSets.find((s) => s.id === setId);
      if (!set) {
        return { success: false, error: 'Semantic set not found' };
      }

      const semanticValue = set.values.find((v) => v.id === valueId);
      if (!semanticValue) {
        return { success: false, error: 'Semantic value not found' };
      }

      const validation = validateLinguisticValue(synonym, semanticValue.synonyms);
      if (!validation.isValid) {
        return { success: false, error: validation.errors[0] };
      }

      const normalizedSynonym = normalizeInput(synonym);
      const updatedValue = addSynonymToValue(semanticValue, normalizedSynonym);

      const updatedSet = {
        ...set,
        values: set.values.map((v) => (v.id === valueId ? updatedValue : v)),
      };

      // Record operation for undo
      recordOperation({
        id: uuidv4(),
        type: 'update',
        entityType: 'semantic-value',
        entityId: valueId,
        previousState: semanticValue,
        newState: updatedValue,
        timestamp: Date.now(),
      });

      updateSemanticSet(setId, { values: updatedSet.values });
      return { success: true };
    },
    [grammar, updateSemanticSet, recordOperation]
  );

  return {
    createSlot,
    updateSlotName,
    removeSlot,
    createSemanticSet: createSemanticSetAction,
    updateSemanticSetName,
    removeSemanticSet,
    addSemanticValue,
    addLinguisticValue,
  };
}
