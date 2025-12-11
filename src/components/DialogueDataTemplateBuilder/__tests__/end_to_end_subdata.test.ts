import { describe, it, expect } from 'vitest';
import { buildDDT } from '../DDTAssembler/DDTBuilder';
import { StepResult } from '../orchestrator/types';

describe('DDT Builder End-to-End SubData Test', () => {
  it('should create a complete DDT with subData-specific prompts', () => {
    // Simula i risultati dei step del backend
    const stepResults: StepResult[] = [
      // Step 1: Detect type
      {
        stepKey: 'detectType',
        payload: { ai: 'date' }
      },
      // Step 2: Suggest structure with subData
      {
        stepKey: 'suggestStructureAndConstraints',
        payload: {
          ai: {
            name: 'birthDate',
            type: 'date',
            subData: [
              { name: 'day', type: 'number', constraints: ['range'] },
              { name: 'month', type: 'number', constraints: ['range'] },
              { name: 'year', type: 'number', constraints: ['range'] }
            ]
          }
        }
      },
      // Step 3: Main data start prompt
      {
        stepKey: 'startPrompt',
        payload: { ai: ['What is your birth date?'] }
      },
      // Step 4: Main data noMatch prompt
      {
        stepKey: 'noMatchPrompts',
        payload: { ai: ['Sorry, I did not understand. Please try again.'] }
      },
      // Step 5: Day subData messages
      {
        stepKey: 'subData_startPrompt_day_0',
        payload: { ai: ['What day were you born?'] }
      },
      {
        stepKey: 'subData_noMatchPrompts_day_0',
        payload: { ai: ['Please enter a valid day between 1 and 31.'] }
      },
      {
        stepKey: 'subData_noInputPrompts_day_0',
        payload: { ai: ['You didn\'t enter a day. Please try again.'] }
      },
      {
        stepKey: 'subData_confirmationPrompts_day_0',
        payload: { ai: ['You said you were born on day {}.'] }
      },
      {
        stepKey: 'subData_successPrompts_day_0',
        payload: { ai: ['Got it! You were born on day {}.'] }
      },
      // Step 6: Month subData messages
      {
        stepKey: 'subData_startPrompt_month_0',
        payload: { ai: ['What month were you born?'] }
      },
      {
        stepKey: 'subData_noMatchPrompts_month_0',
        payload: { ai: ['Please enter a valid month between 1 and 12.'] }
      },
      {
        stepKey: 'subData_noInputPrompts_month_0',
        payload: { ai: ['You didn\'t enter a month. Please try again.'] }
      },
      {
        stepKey: 'subData_confirmationPrompts_month_0',
        payload: { ai: ['You said you were born in month {}.'] }
      },
      {
        stepKey: 'subData_successPrompts_month_0',
        payload: { ai: ['Got it! You were born in month {}.'] }
      },
      // Step 7: Year subData messages
      {
        stepKey: 'subData_startPrompt_year_0',
        payload: { ai: ['What year were you born?'] }
      },
      {
        stepKey: 'subData_noMatchPrompts_year_0',
        payload: { ai: ['Please enter a valid year.'] }
      },
      {
        stepKey: 'subData_noInputPrompts_year_0',
        payload: { ai: ['You didn\'t enter a year. Please try again.'] }
      },
      {
        stepKey: 'subData_confirmationPrompts_year_0',
        payload: { ai: ['You said you were born in year {}.'] }
      },
      {
        stepKey: 'subData_successPrompts_year_0',
        payload: { ai: ['Got it! You were born in year {}.'] }
      }
    ];

    // Crea il DDT
    const ddtId = 'test-birth-date-ddt';
    const dataNode = {
      name: 'birthDate',
      label: 'Birth Date',
      variable: 'birthDate',
      type: 'date',
      subData: [
        {
          name: 'day',
          label: 'Day',
          variable: 'day',
          type: 'number',
          constraints: [{ type: 'range', min: 1, max: 31 }]
        },
        {
          name: 'month',
          label: 'Month',
          variable: 'month',
          type: 'number',
          constraints: [{ type: 'range', min: 1, max: 12 }]
        },
        {
          name: 'year',
          label: 'Year',
          variable: 'year',
          type: 'number',
          constraints: [{ type: 'range', min: 1900, max: 2024 }]
        }
      ]
    };

    const result = buildDDT(ddtId, dataNode, stepResults);

    // Verifica la struttura del DDT
    expect(result.id).toBe(ddtId);
    expect(result.label).toBe('Birth Date');
    expect(result.mainData.subData).toHaveLength(3);

    // Verifica che i subData abbiano i prompt specifici
    const daySubData = result.mainData.subData.find((s: any) => s.variable === 'day');
    const monthSubData = result.mainData.subData.find((s: any) => s.variable === 'month');
    const yearSubData = result.mainData.subData.find((s: any) => s.variable === 'year');

    expect(daySubData).toBeDefined();
    expect(monthSubData).toBeDefined();
    expect(yearSubData).toBeDefined();

    // Verifica che ogni subData abbia i suoi step con i prompt specifici
    const dayStartStep = daySubData.steps.find((s: any) => s.type === 'start');
    const monthStartStep = monthSubData.steps.find((s: any) => s.type === 'start');
    const yearStartStep = yearSubData.steps.find((s: any) => s.type === 'start');

    expect(dayStartStep.escalations).toHaveLength(1);
    expect(monthStartStep.escalations).toHaveLength(1);
    expect(yearStartStep.escalations).toHaveLength(1);

    // Verifica che le traduzioni contengano i messaggi specifici
    // ✅ MIGRATION: Support both tasks (new) and actions (legacy)
    const dayTask = dayStartStep.escalations[0].tasks?.[0] || dayStartStep.escalations[0].actions?.[0];
    const monthTask = monthStartStep.escalations[0].tasks?.[0] || monthStartStep.escalations[0].actions?.[0];
    const yearTask = yearStartStep.escalations[0].tasks?.[0] || yearStartStep.escalations[0].actions?.[0];
    const dayParameterValue = dayTask?.parameters?.[0]?.value;
    const monthParameterValue = monthTask?.parameters?.[0]?.value;
    const yearParameterValue = yearTask?.parameters?.[0]?.value;

    expect(result.translations[dayParameterValue]).toContain('What day were you born?');
    expect(result.translations[monthParameterValue]).toContain('What month were you born?');
    expect(result.translations[yearParameterValue]).toContain('What year were you born?');

    // Verifica che i messaggi siano diversi per ogni subData
    expect(result.translations[dayParameterValue]).not.toBe(result.translations[monthParameterValue]);
    expect(result.translations[monthParameterValue]).not.toBe(result.translations[yearParameterValue]);
    expect(result.translations[dayParameterValue]).not.toBe(result.translations[yearParameterValue]);

    console.log('✅ DDT generato con successo con prompt specifici per subData:');
    console.log('  - Day:', result.translations[dayParameterValue]);
    console.log('  - Month:', result.translations[monthParameterValue]);
    console.log('  - Year:', result.translations[yearParameterValue]);
  });

  it('should handle DDT without subData correctly', () => {
    const stepResults: StepResult[] = [
      {
        stepKey: 'startPrompt',
        payload: { ai: ['What is your name?'] }
      },
      {
        stepKey: 'noMatchPrompts',
        payload: { ai: ['Sorry, I did not understand. Please try again.'] }
      }
    ];

    const ddtId = 'test-simple-ddt';
    const dataNode = {
      name: 'name',
      label: 'Name',
      variable: 'name'
    };

    const result = buildDDT(ddtId, dataNode, stepResults);

    expect(result.id).toBe(ddtId);
    expect(result.label).toBe('Name');
    expect(result.mainData.subData).toHaveLength(0);
    expect(result.mainData.steps).toHaveLength(5); // start, noMatch, noInput, confirmation, success
  });
});