// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect } from 'vitest';
import { buildStepPlan } from '../stepPlan';
import { buildArtifactStore } from '../artifactStore';
import { assembleFinalTaskTree } from '../assembleFinal';
import type { SchemaNode } from '../dataCollection';
import type { PlanRunResult } from '../planRunner';

describe('Backend Logic - Preserved Files (Anti-Regression Tests)', () => {
  describe('stepPlan.ts', () => {
    it('should build step plan for main data with constraints', () => {
      const mains: SchemaNode[] = [
        {
          label: 'Date of Birth',
          type: 'date',
          constraints: [
            { kind: 'min', value: '1900-01-01' },
            { kind: 'max', value: '2024-12-31' }
          ]
        }
      ];

      const plan = buildStepPlan(mains);

      // Verify plan is not empty
      expect(plan.length).toBeGreaterThan(0);

      // Verify base steps for main (path is normalized: spaces become part of path, not replaced)
      // The seg() function only replaces '/' with '-', so "Date of Birth" stays as "Date of Birth"
      const mainSteps = plan.filter(s => s.path === 'Date of Birth');
      expect(mainSteps.some(s => s.type === 'start')).toBe(true);
      expect(mainSteps.some(s => s.type === 'noMatch')).toBe(true);
      expect(mainSteps.some(s => s.type === 'noInput')).toBe(true);
      expect(mainSteps.some(s => s.type === 'confirmation')).toBe(true);
      expect(mainSteps.some(s => s.type === 'notConfirmed')).toBe(true);
      expect(mainSteps.some(s => s.type === 'success')).toBe(true);

      // Verify constraint steps (2 constraints × 3 step types = 6 steps)
      const constraintSteps = plan.filter(s =>
        s.path === 'Date of Birth' &&
        ['constraintMessages', 'validator', 'testset'].includes(s.type)
      );
      expect(constraintSteps.length).toBe(6);
    });

    it('should build step plan for subData correctly', () => {
      const mains: SchemaNode[] = [
        {
          label: 'Date of Birth',
          type: 'date',
          subData: [
            { label: 'Day', type: 'number' },
            { label: 'Month', type: 'number' }
          ]
        }
      ];

      const plan = buildStepPlan(mains);

      // Verify steps for subData (path format: "Main/Sub", seg() only replaces '/' in labels, not in path separator)
      const subDaySteps = plan.filter(s => s.path === 'Date of Birth/Day');
      expect(subDaySteps.some(s => s.type === 'start')).toBe(true);
      expect(subDaySteps.some(s => s.type === 'noMatch')).toBe(true);
      expect(subDaySteps.some(s => s.type === 'noInput')).toBe(true);

      // SubData should NOT have confirmation/success/notConfirmed
      expect(subDaySteps.some(s => s.type === 'confirmation')).toBe(false);
      expect(subDaySteps.some(s => s.type === 'notConfirmed')).toBe(false);
      expect(subDaySteps.some(s => s.type === 'success')).toBe(false);
    });

    it('should handle empty mains array', () => {
      const plan = buildStepPlan([]);
      expect(plan).toEqual([]);
    });

    it('should handle mains without constraints', () => {
      const mains: SchemaNode[] = [
        {
          label: 'Simple Field',
          type: 'text'
        }
      ];

      const plan = buildStepPlan(mains);

      // Should have base steps but no constraint steps
      const mainSteps = plan.filter(s => s.path === 'Simple Field');
      expect(mainSteps.length).toBe(6); // start, noMatch, noInput, confirmation, notConfirmed, success

      const constraintSteps = plan.filter(s =>
        s.path === 'Simple Field' &&
        ['constraintMessages', 'validator', 'testset'].includes(s.type)
      );
      expect(constraintSteps.length).toBe(0);
    });
  });

  describe('artifactStore.ts', () => {
    it('should build artifact store from plan results', () => {
      const results: PlanRunResult[] = [
        {
          step: { path: 'Date of Birth', type: 'start' },
          payload: { text: 'What is your date of birth?' }
        },
        {
          step: { path: 'Date of Birth', type: 'constraintMessages', constraintKind: 'min' },
          payload: { text: 'Date must be after 1900' }
        },
        {
          step: { path: 'Date of Birth', type: 'validator', constraintKind: 'min' },
          payload: { code: 'function validate() { ... }' }
        },
        {
          step: { path: 'Date of Birth', type: 'testset', constraintKind: 'min' },
          payload: { tests: [] }
        }
      ];

      const store = buildArtifactStore(results);

      expect(store.byPath['Date of Birth']).toBeDefined();
      expect(store.byPath['Date of Birth'].start).toBeDefined();
      expect(store.byPath['Date of Birth'].constraints['min']).toBeDefined();
      expect(store.byPath['Date of Birth'].constraints['min'].messages).toBeDefined();
      expect(store.byPath['Date of Birth'].constraints['min'].validator).toBeDefined();
      expect(store.byPath['Date of Birth'].constraints['min'].testset).toBeDefined();
    });

    it('should handle empty results', () => {
      const store = buildArtifactStore([]);
      expect(store.byPath).toEqual({});
    });

    it('should organize constraints by kind', () => {
      const results: PlanRunResult[] = [
        {
          step: { path: 'Field', type: 'constraintMessages', constraintKind: 'min' },
          payload: { text: 'Min message' }
        },
        {
          step: { path: 'Field', type: 'constraintMessages', constraintKind: 'max' },
          payload: { text: 'Max message' }
        }
      ];

      const store = buildArtifactStore(results);

      expect(store.byPath['Field'].constraints['min']).toBeDefined();
      expect(store.byPath['Field'].constraints['max']).toBeDefined();
      expect(store.byPath['Field'].constraints['min'].messages).toBeDefined();
      expect(store.byPath['Field'].constraints['max'].messages).toBeDefined();
    });
  });

  describe('assembleFinal.ts', () => {
    it('should assemble TaskTree from SchemaNode and ArtifactStore', async () => {
      const mains: SchemaNode[] = [
        {
          label: 'Date of Birth',
          type: 'date',
          subData: [
            { label: 'Day', type: 'number' }
          ]
        }
      ];

      const store = buildArtifactStore([]);

      const result = await assembleFinalTaskTree('Test Task', mains, store, {
        escalationCounts: { noMatch: 3, noInput: 3, confirmation: 2 },
        projectLocale: 'en',
        templateTranslations: {},
        addTranslations: () => {}
      });

      // Verify basic structure
      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.nodes.length).toBeGreaterThan(0);

      // Verify that data is not present (Phase 2)
      expect(result.data).toBeUndefined();

      // Verify id and label
      expect(result.id).toBeDefined();
      expect(result.label).toBe('Test Task');
    });

    it('should handle empty SchemaNode array', async () => {
      const store = buildArtifactStore([]);

      const result = await assembleFinalTaskTree('Empty Task', [], store, {
        escalationCounts: { noMatch: 3, noInput: 3, confirmation: 2 },
        projectLocale: 'en',
        templateTranslations: {},
        addTranslations: () => {}
      });

      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
      expect(result.label).toBe('Empty Task');
    });
  });

  describe('Integration: stepPlan → artifactStore → assembleFinal', () => {
    it('should complete full pipeline without errors', async () => {
      const mains: SchemaNode[] = [
        {
          label: 'Full Name',
          type: 'text',
          constraints: [
            { kind: 'minLength', minLength: 2 }
          ]
        }
      ];

      // 1. Build plan
      const plan = buildStepPlan(mains);
      expect(plan.length).toBeGreaterThan(0);

      // 2. Simulate plan results
      const results: PlanRunResult[] = plan.map(step => ({
        step,
        payload: { text: `Mocked response for ${step.type}` }
      }));

      // 3. Build artifact store
      const store = buildArtifactStore(results);
      expect(store.byPath).toBeDefined();

      // 4. Assemble final TaskTree
      const taskTree = await assembleFinalTaskTree('Integration Test', mains, store, {
        escalationCounts: { noMatch: 3, noInput: 3, confirmation: 2 },
        projectLocale: 'en',
        templateTranslations: {},
        addTranslations: () => {}
      });

      // Verify final result
      expect(taskTree.nodes).toBeDefined();
      expect(taskTree.nodes.length).toBeGreaterThan(0);
      expect(taskTree.label).toBe('Integration Test');
    });
  });
});
