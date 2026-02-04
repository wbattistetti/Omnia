import { describe, it, expect } from 'vitest';
import { buildDDT } from '../DDTAssembler/DDTBuilder';
import { StepResult } from '../orchestrator/types';

describe('DDT Builder - SubData parsing test (Day)', () => {
  it('should correctly parse real subData messages for Day', () => {
            const stepResults: StepResult[] = [
          {
            stepKey: 'subData_startPrompt_Day_0',
            payload: { ai: ["What day?"] }
          },
          {
            stepKey: 'subData_noMatchPrompts_Day_0',
            payload: { ai: ["I didn't understand that. Please enter a day between 1 and 31."] }
          },
          {
            stepKey: 'subData_successPrompts_Day_0',
            payload: { ai: ["Day saved successfully."] }
          }
        ];

    const dataNode = {
      name: 'birthDate',
      subData: [{ name: 'day', label: 'Day' }]
    };

    const result = buildDDT('test', dataNode, stepResults);

    const daySubData = result.data.subData.find(s => s.label === 'Day');
    expect(daySubData).toBeDefined();

    const startStep = daySubData.steps.find(s => s.type === 'start');
    expect(startStep).toBeDefined();
    expect(startStep.escalations.length).toBeGreaterThan(0);

    // Verifica che le traduzioni contengano i messaggi specifici (come nel test data)
    // ✅ MIGRATION: Support both tasks (new) and actions (legacy)
    const startTask = startStep.escalations[0].tasks?.[0] || startStep.escalations[0].actions?.[0];
    const startParameterValue = startTask?.parameters?.[0]?.value;
    expect(result.translations[startParameterValue]).toContain("What day?");

    const noMatchStep = daySubData.steps.find(s => s.type === 'noMatch');
    expect(noMatchStep).toBeDefined();
    expect(noMatchStep.escalations.length).toBeGreaterThan(0);
    const noMatchTask = noMatchStep.escalations[0].tasks?.[0] || noMatchStep.escalations[0].actions?.[0];
    const noMatchParameterValue = noMatchTask?.parameters?.[0]?.value;
    expect(result.translations[noMatchParameterValue]).toContain("I didn't understand that. Please enter a day between 1 and 31.");

    const successStep = daySubData.steps.find(s => s.type === 'success');
    expect(successStep).toBeDefined();
    expect(successStep.escalations.length).toBeGreaterThan(0);
    const successTask = successStep.escalations[0].tasks?.[0] || successStep.escalations[0].actions?.[0];
    const successParameterValue = successTask?.parameters?.[0]?.value;
    expect(result.translations[successParameterValue]).toContain("Day saved successfully.");
  });
});