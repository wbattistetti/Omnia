import { describe, it, expect } from 'vitest';
import { buildStepsWithSubData } from '../buildStepMessagesFromResults';

describe('buildStepsWithSubData (subdata changes)', () => {
  it('subData stepMessages should not include confirmation/success', () => {
    const stepResults = [
      { stepKey: 'startPrompt', payload: { ai: ['Ask main'] } },
      { stepKey: 'noMatchPrompts', payload: { ai: ['NoMatch main'] } },
      { stepKey: 'noInputPrompts', payload: { ai: ['NoInput main'] } },
      { stepKey: 'confirmationPrompts', payload: { ai: ['Confirm main'] } },
      { stepKey: 'successPrompts', payload: { ai: ['Success main'] } },
      // sub data (Day)
      { stepKey: 'subData_startPrompt_Day_0', payload: { ai: ['Ask day'] } },
      { stepKey: 'subData_noMatchPrompts_Day_0', payload: { ai: ['NoMatch day'] } },
      { stepKey: 'subData_noInputPrompts_Day_0', payload: { ai: ['NoInput day'] } },
      { stepKey: 'subData_confirmationPrompts_Day_0', payload: { ai: ['Confirm day'] } },
      { stepKey: 'subData_successPrompts_Day_0', payload: { ai: ['Success day'] } },
    ] as any;

    const res = buildStepsWithSubData(stepResults);
    expect(res.subData.day.start?.length).toBe(1);
    expect(res.subData.day.noMatch?.length).toBe(1);
    expect(res.subData.day.noInput?.length).toBe(1);
    expect(res.subData.day.confirmation).toBeUndefined();
    expect(res.subData.day.success).toBeUndefined();
    expect(res.mainData.confirmation?.length).toBeGreaterThan(0);
    expect(res.mainData.success?.length).toBeGreaterThan(0);
  });
});


