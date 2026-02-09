// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildStepPlan } from '../TaskTreeWizard/stepPlan';
import { buildArtifactStore } from '../TaskTreeWizard/artifactStore';
import { assembleFinalTaskTree } from '../TaskTreeWizard/assembleFinal';
import type { SchemaNode } from '../TaskTreeWizard/dataCollection';
import type { PlanRunResult } from '../TaskTreeWizard/planRunner';
import { convertWizardTaskTreeToTaskTree } from '../TaskBuilderAIWizardAdapter';
import type { WizardTaskTreeNode } from '../../../TaskBuilderAIWizard/types';

describe('E2E: New Wizard Integration with Backend Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full pipeline: stepPlan → planRunner → artifactStore → assembleFinal → TaskTree conversion', async () => {
    // 1. Simulate user input: "chiedi la data di nascita del paziente"
    const userInput = 'chiedi la data di nascita del paziente';

    // 2. Simulate structure generation (this would come from AI in real scenario)
    const mains: SchemaNode[] = [
      {
        label: 'Date of Birth',
        type: 'date',
        constraints: [
          { kind: 'min', value: '1900-01-01' },
          { kind: 'max', value: '2024-12-31' }
        ],
        subData: [
          { label: 'Day', type: 'number' },
          { label: 'Month', type: 'number' },
          { label: 'Year', type: 'number' }
        ]
      }
    ];

    // 3. Build step plan using backend logic
    const plan = buildStepPlan(mains);
    expect(plan.length).toBeGreaterThan(0);

    // Verify plan structure
    const mainSteps = plan.filter(s => s.path === 'Date of Birth');
    expect(mainSteps.some(s => s.type === 'start')).toBe(true);
    expect(mainSteps.some(s => s.type === 'noMatch')).toBe(true);
    expect(mainSteps.some(s => s.type === 'noInput')).toBe(true);

    // Verify constraint steps
    const constraintSteps = plan.filter(s =>
      s.path === 'Date of Birth' &&
      ['constraintMessages', 'validator', 'testset'].includes(s.type)
    );
    expect(constraintSteps.length).toBe(6); // 2 constraints × 3 step types

    // Verify subData steps
    const subDaySteps = plan.filter(s => s.path === 'Date of Birth/Day');
    expect(subDaySteps.some(s => s.type === 'start')).toBe(true);
    expect(subDaySteps.some(s => s.type === 'noMatch')).toBe(true);
    expect(subDaySteps.some(s => s.type === 'noInput')).toBe(true);

    // 4. Simulate plan execution (mock API responses)
    const results: PlanRunResult[] = plan.map(step => ({
      step,
      payload: {
        text: `Mocked response for ${step.type} at ${step.path}`,
        textKey: `runtime.test.${step.path}.${step.type}`
      }
    }));

    // 5. Build artifact store from results
    const store = buildArtifactStore(results);
    expect(store.byPath).toBeDefined();
    expect(store.byPath['Date of Birth']).toBeDefined();
    expect(store.byPath['Date of Birth'].start).toBeDefined();
    expect(store.byPath['Date of Birth'].constraints).toBeDefined();

    // 6. Assemble final TaskTree using backend logic
    const taskTree = await assembleFinalTaskTree('Date of Birth', mains, store, {
      escalationCounts: { noMatch: 3, noInput: 3, confirmation: 2 },
      projectLocale: 'en',
      templateTranslations: {},
      addTranslations: () => {}
    });

    // Verify TaskTree structure
    expect(taskTree.nodes).toBeDefined();
    expect(Array.isArray(taskTree.nodes)).toBe(true);
    expect(taskTree.nodes.length).toBeGreaterThan(0);
    expect(taskTree.label).toBe('Date of Birth');
    expect(taskTree.id).toBeDefined();

    // 7. Simulate conversion to WizardTaskTreeNode (for new wizard UI)
    // This simulates what the new wizard would receive
    const wizardNodes: WizardTaskTreeNode[] = [
      {
        id: taskTree.nodes[0]?.id || 'test-id',
        templateId: taskTree.nodes[0]?.templateId || 'test-template',
        label: taskTree.nodes[0]?.label || 'Date of Birth',
        type: taskTree.nodes[0]?.type || 'date',
        constraints: taskTree.nodes[0]?.constraints || [],
        subNodes: taskTree.nodes[0]?.subNodes?.map(sub => ({
          id: sub.id,
          templateId: sub.templateId || '',
          label: sub.label,
          type: sub.type,
          constraints: sub.constraints || []
        })) || []
      }
    ];

    // 8. Convert back to TaskTree (simulating new wizard completion)
    const convertedTaskTree = convertWizardTaskTreeToTaskTree(
      wizardNodes,
      'date_of_birth',
      undefined // No messages in this test
    );

    // Verify conversion
    expect(convertedTaskTree.nodes).toBeDefined();
    expect(convertedTaskTree.labelKey).toBe('date_of_birth');
    expect(convertedTaskTree.nodes.length).toBeGreaterThan(0);
  });

  it('should handle complex task with multiple main nodes and constraints', async () => {
    const mains: SchemaNode[] = [
      {
        label: 'Full Name',
        type: 'text',
        constraints: [
          { kind: 'minLength', minLength: 2 },
          { kind: 'maxLength', maxLength: 100 }
        ]
      },
      {
        label: 'Email',
        type: 'email',
        constraints: [
          { kind: 'format', format: 'email' }
        ]
      }
    ];

    // Build plan
    const plan = buildStepPlan(mains);
    expect(plan.length).toBeGreaterThan(0);

    // Verify both main nodes are in plan
    const fullNameSteps = plan.filter(s => s.path === 'Full Name');
    const emailSteps = plan.filter(s => s.path === 'Email');
    expect(fullNameSteps.length).toBeGreaterThan(0);
    expect(emailSteps.length).toBeGreaterThan(0);

    // Simulate results
    const results: PlanRunResult[] = plan.map(step => ({
      step,
      payload: { text: `Response for ${step.type}` }
    }));

    // Build store and assemble
    const store = buildArtifactStore(results);
    const taskTree = await assembleFinalTaskTree('User Registration', mains, store, {
      escalationCounts: { noMatch: 3, noInput: 3, confirmation: 2 },
      projectLocale: 'en',
      templateTranslations: {},
      addTranslations: () => {}
    });

    // Verify both nodes are present
    expect(taskTree.nodes.length).toBeGreaterThanOrEqual(2);
    const nodeLabels = taskTree.nodes.map(n => n.label);
    expect(nodeLabels).toContain('Full Name');
    expect(nodeLabels).toContain('Email');
  });

  it('should preserve backend logic functionality after old wizard removal', async () => {
    // This test ensures that removing the old wizard UI didn't break backend logic
    const mains: SchemaNode[] = [
      {
        label: 'Test Field',
        type: 'text'
      }
    ];

    // All backend functions should still work
    const plan = buildStepPlan(mains);
    expect(plan).toBeDefined();
    expect(Array.isArray(plan)).toBe(true);

    const results: PlanRunResult[] = plan.map(step => ({
      step,
      payload: { text: 'test' }
    }));

    const store = buildArtifactStore(results);
    expect(store).toBeDefined();

    const taskTree = await assembleFinalTaskTree('Test', mains, store, {
      escalationCounts: { noMatch: 3, noInput: 3, confirmation: 2 },
      projectLocale: 'en',
      templateTranslations: {},
      addTranslations: () => {}
    });

    expect(taskTree).toBeDefined();
    expect(taskTree.nodes).toBeDefined();
    expect(taskTree.label).toBe('Test');
  });

  it('should verify no broken imports after old wizard removal', () => {
    // This test ensures that all imports are valid after removal
    // If any import is broken, this test will fail at import time
    // Since we're using ES6 imports at the top of the file, if they work,
    // the functions should be available

    // Verify all imported functions are defined
    expect(buildStepPlan).toBeDefined();
    expect(typeof buildStepPlan).toBe('function');

    expect(buildArtifactStore).toBeDefined();
    expect(typeof buildArtifactStore).toBe('function');

    expect(assembleFinalTaskTree).toBeDefined();
    expect(typeof assembleFinalTaskTree).toBe('function');

    expect(convertWizardTaskTreeToTaskTree).toBeDefined();
    expect(typeof convertWizardTaskTreeToTaskTree).toBe('function');
  });
});
