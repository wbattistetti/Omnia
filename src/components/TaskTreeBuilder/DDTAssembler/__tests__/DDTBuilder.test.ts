import { describe, it, expect } from 'vitest';
import { buildDDT } from '../DDTBuilder';
import { StepResult } from '../../orchestrator/types';

describe('DDTBuilder', () => {
  it('should build DDT with data only', () => {
    const ddtId = 'test-ddt';
    const dataNode = {
      name: 'birthDate',
      label: 'Birth Date',
      variable: 'birthDate',
      constraints: [
        { type: 'required', value: true }
      ]
    };

    const stepResults: StepResult[] = [
      {
        stepKey: 'startPrompt',
        payload: { ai: ['What is your birth date?'] }
      },
      {
        stepKey: 'noMatchPrompts',
        payload: { ai: ['Sorry, I did not understand. Please try again.'] }
      }
    ];

    const result = buildDDT(ddtId, dataNode, stepResults);

    expect(result.id).toBe(ddtId);
    expect(result.label).toBe('Birth Date');
    expect(result.data.constraints).toHaveLength(1);
    expect(result.data.steps).toHaveLength(5); // start, noMatch, noInput, confirmation, success
    expect(result.data.subData).toHaveLength(0);
  });

  it('should build DDT with subData and their specific messages', () => {
    const ddtId = 'test-ddt';
    const dataNode = {
      name: 'birthDate',
      label: 'Birth Date',
      variable: 'birthDate',
      constraints: [
        { type: 'required', value: true }
      ],
      subData: [
        {
          name: 'day',
          label: 'Day',
          variable: 'day',
          constraints: [
            { type: 'range', min: 1, max: 31 }
          ]
        },
        {
          name: 'month',
          label: 'Month',
          variable: 'month',
          constraints: [
            { type: 'range', min: 1, max: 12 }
          ]
        }
      ]
    };

    const stepResults: StepResult[] = [
      {
        stepKey: 'startPrompt',
        payload: { ai: ['What is your birth date?'] }
      },
      {
        stepKey: 'subDataMessages_day_0',
        payload: { 
          ai: {
            start: ['What day were you born?'],
            noMatch: ['That is not a valid day. Please try again.']
          }
        }
      },
      {
        stepKey: 'subDataMessages_month_0',
        payload: { 
          ai: {
            start: ['What month were you born?'],
            noMatch: ['That is not a valid month. Please try again.']
          }
        }
      }
    ];

    const result = buildDDT(ddtId, dataNode, stepResults);

    expect(result.id).toBe(ddtId);
    expect(result.label).toBe('Birth Date');
    expect(result.data.constraints).toHaveLength(1);
    expect(result.data.steps).toHaveLength(5);
    expect(result.data.subData).toHaveLength(2);

    // Check that subData have their specific messages
    const daySubData = result.data.subData.find((s: any) => s.variable === 'day');
    const monthSubData = result.data.subData.find((s: any) => s.variable === 'month');

    expect(daySubData).toBeDefined();
    expect(monthSubData).toBeDefined();

    // Check that subData steps use their specific messages
    const dayStartStep = daySubData.steps.find((s: any) => s.type === 'start');
    const monthStartStep = monthSubData.steps.find((s: any) => s.type === 'start');

    // Check that subData steps have escalations with actions
    expect(dayStartStep.escalations).toBeDefined();
    expect(monthStartStep.escalations).toBeDefined();
    
    // Check that the first escalation has actions with the correct parameter values
    const dayFirstEscalation = dayStartStep.escalations[0];
    const monthFirstEscalation = monthStartStep.escalations[0];
    
    expect(dayFirstEscalation.actions).toBeDefined();
    expect(monthFirstEscalation.actions).toBeDefined();
    
    // Check that the parameter value contains the expected text
    const dayParameterValue = dayFirstEscalation.actions[0].parameters[0].value;
    const monthParameterValue = monthFirstEscalation.actions[0].parameters[0].value;
    
    // The parameter value should be a translation key, but we can check that it's defined
    expect(dayParameterValue).toBeDefined();
    expect(monthParameterValue).toBeDefined();
    
    // Check that the translations contain the expected messages
    expect(result.translations[dayParameterValue]).toContain('What day were you born?');
    expect(result.translations[monthParameterValue]).toContain('What month were you born?');
  });

  it('should handle empty stepResults gracefully', () => {
    const ddtId = 'test-ddt';
    const dataNode = {
      name: 'test',
      label: 'Test',
      variable: 'test'
    };

    const stepResults: StepResult[] = [];

    const result = buildDDT(ddtId, dataNode, stepResults);

    expect(result.id).toBe(ddtId);
    expect(result.label).toBe('Test');
    expect(result.data.constraints).toHaveLength(0);
    expect(result.data.steps).toHaveLength(5); // Still creates all step types
    expect(result.data.subData).toHaveLength(0);
  });
}); 