import { describe, it, expect } from 'vitest';
import { buildPlan, isSaturated, nextMissingSub, applyComposite, setMemory } from '../state';
import type { DDTNode } from '../model/ddt.v2.types';

describe('state helpers', () => {
  const main: DDTNode = {
    id: 'date',
    label: 'Date',
    type: 'main',
    required: true,
    kind: 'date',
    steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } },
    subs: ['day', 'month', 'year'],
  };
  const day: DDTNode = { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any;
  const month: DDTNode = { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any;
  const year: DDTNode = { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any;

  it('buildPlan flattens main followed by subs', () => {
    const plan = buildPlan([main, day, month, year]);
    expect(plan.order).toEqual(['date', 'day', 'month', 'year']);
    expect(plan.byId['month'].label).toBe('Month');
  });

  it('isSaturated for date depends on day/month/year', () => {
    let mem: any = {};
    expect(isSaturated(main, mem)).toBe(false);
    mem = setMemory(mem, 'date', { day: 1 }, false);
    expect(isSaturated(main, mem)).toBe(false);
    mem = setMemory(mem, 'date', { day: 1, month: 2, year: 1990 }, false);
    expect(isSaturated(main, mem)).toBe(true);
  });

  it('nextMissingSub returns first missing sub id', () => {
    const mem: any = { day: { value: 1, confirmed: false } };
    expect(nextMissingSub(main, mem)).toBe('month');
  });

  it('applyComposite for date returns partials and complete flags', () => {
    const p1 = applyComposite('date', '12/05/1990');
    expect(p1.complete).toBe(true);
    const p2 = applyComposite('date', '1990');
    expect(p2.complete).toBe(false);
    expect(p2.missing.includes('day')).toBe(true);
  });
});


