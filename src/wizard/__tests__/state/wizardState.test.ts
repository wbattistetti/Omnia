// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Wizard State Tests
 *
 * Unit tests for wizard state management functions.
 * Tests pure functions for correctness and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialWizardState,
  setPhase,
  updateStructure,
  setRootLabel,
  setTemplateFound,
  setIterationFeedback,
  canProceedToNextPhase
} from '../../state/wizardState';
import type { WizardPhase, SchemaNode } from '../../types/wizard.types';

describe('wizardState', () => {
  describe('createInitialWizardState', () => {
    it('should create initial state with default root label', () => {
      const state = createInitialWizardState();
      expect(state.phase).toBe('template-search');
      expect(state.rootLabel).toBe('Data');
      expect(state.structure).toEqual([]);
      expect(state.templateFound).toBe(false);
      expect(state.iterationCount).toBe(0);
    });

    it('should create initial state with custom root label', () => {
      const state = createInitialWizardState('Custom');
      expect(state.rootLabel).toBe('Custom');
    });
  });

  describe('setPhase', () => {
    it('should update phase', () => {
      const state = createInitialWizardState();
      const updated = setPhase(state, 'mode-selection');
      expect(updated.phase).toBe('mode-selection');
      expect(state.phase).toBe('template-search'); // Original unchanged
    });
  });

  describe('updateStructure', () => {
    it('should update structure', () => {
      const state = createInitialWizardState();
      const structure: SchemaNode[] = [
        { id: '1', label: 'Node 1' }
      ];
      const updated = updateStructure(state, structure);
      expect(updated.structure).toEqual(structure);
      expect(state.structure).toEqual([]); // Original unchanged
    });
  });

  describe('setRootLabel', () => {
    it('should update root label', () => {
      const state = createInitialWizardState();
      const updated = setRootLabel(state, 'New Label');
      expect(updated.rootLabel).toBe('New Label');
      expect(state.rootLabel).toBe('Data'); // Original unchanged
    });
  });

  describe('setTemplateFound', () => {
    it('should set template found to true', () => {
      const state = createInitialWizardState();
      const updated = setTemplateFound(state, true);
      expect(updated.templateFound).toBe(true);
      expect(state.templateFound).toBe(false); // Original unchanged
    });

    it('should set template found to false', () => {
      const state = createInitialWizardState();
      const updatedWithTemplate = setTemplateFound(state, true);
      const updated = setTemplateFound(updatedWithTemplate, false);
      expect(updated.templateFound).toBe(false);
    });
  });

  describe('setIterationFeedback', () => {
    it('should set feedback and increment iteration count', () => {
      const state = createInitialWizardState();
      const updated = setIterationFeedback(state, 'Test feedback');
      expect(updated.iterationFeedback).toBe('Test feedback');
      expect(updated.iterationCount).toBe(1);
      expect(state.iterationCount).toBe(0); // Original unchanged
    });

    it('should increment iteration count on multiple calls', () => {
      const state = createInitialWizardState();
      const updated1 = setIterationFeedback(state, 'First');
      const updated2 = setIterationFeedback(updated1, 'Second');
      expect(updated2.iterationCount).toBe(2);
    });
  });

  describe('canProceedToNextPhase', () => {
    it('should allow proceeding from template-search to structure-proposal when no template found', () => {
      const state = createInitialWizardState();
      expect(canProceedToNextPhase(state, 'structure-proposal')).toBe(true);
    });

    it('should allow proceeding from structure-proposal to iteration', () => {
      const state = setPhase(createInitialWizardState(), 'structure-proposal');
      expect(canProceedToNextPhase(state, 'iteration')).toBe(true);
    });

    it('should allow proceeding from structure-proposal to mode-selection', () => {
      const state = setPhase(createInitialWizardState(), 'structure-proposal');
      expect(canProceedToNextPhase(state, 'mode-selection')).toBe(true);
    });

    it('should allow proceeding from mode-selection to pipeline when structure exists', () => {
      const state = setPhase(createInitialWizardState(), 'mode-selection');
      const stateWithStructure = updateStructure(state, [{ id: '1', label: 'Node' }]);
      expect(canProceedToNextPhase(stateWithStructure, 'pipeline')).toBe(true);
    });

    it('should not allow proceeding from mode-selection to pipeline when no structure', () => {
      const state = setPhase(createInitialWizardState(), 'mode-selection');
      expect(canProceedToNextPhase(state, 'pipeline')).toBe(false);
    });
  });
});
