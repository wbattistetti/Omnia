import { describe, it, expect } from 'vitest';
import { buildStepPlan } from '../stepPlan';

describe('stepPlan notConfirmed main-only', () => {
  it('main includes notConfirmed after confirmation; sub excludes it', () => {
    const mains = [
      {
        label: 'Person',
        type: 'object',
        subData: [ { label: 'day' } ]
      }
    ] as any;
    const steps = buildStepPlan(mains);
    const mainTypes = steps.filter(s => s.path === 'Person').map(s => s.type);
    expect(mainTypes).toEqual(['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success']);
    const subTypes = steps.filter(s => s.path === 'Person/day').map(s => s.type);
    expect(subTypes).toEqual(['start', 'noMatch', 'noInput']);
  });
});


