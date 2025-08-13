import { describe, it, expect } from 'vitest';
import { buildStepPlan } from '../stepPlan';

describe('stepPlan (subdata changes)', () => {
  it('subdata should not include confirmation/success', () => {
    const mains = [
      {
        label: 'Person',
        type: 'object',
        subData: [
          { label: 'day', type: 'number' },
          { label: 'month', type: 'number' },
        ],
      },
    ] as any;
    const steps = buildStepPlan(mains);
    const subDay = steps.filter((s) => s.path === 'Person/day').map((s) => s.type);
    const subMonth = steps.filter((s) => s.path === 'Person/month').map((s) => s.type);
    expect(subDay).toEqual(['start', 'noMatch', 'noInput']);
    expect(subMonth).toEqual(['start', 'noMatch', 'noInput']);
    const main = steps.filter((s) => s.path === 'Person').map((s) => s.type);
    expect(main).toEqual(['start', 'noMatch', 'noInput', 'confirmation', 'success']);
  });
});


