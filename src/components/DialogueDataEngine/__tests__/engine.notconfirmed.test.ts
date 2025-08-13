import { describe, it, expect } from 'vitest';
import { initEngine, advance } from '../engine';
import type { DDTTemplateV2 } from '../model/ddt.v2.types';

const template: DDTTemplateV2 = {
  schemaVersion: '2',
  metadata: { id: 'DDT_Date', label: 'Date' },
  nodes: [
    {
      id: 'date',
      label: 'Date',
      type: 'main',
      required: true,
      kind: 'date',
      steps: { ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] }, success: { base: ['ok'] }, confirm: { base: 'c', noInput: ['', '', ''], noMatch: ['', '', ''] } },
      subs: ['day', 'month', 'year'],
    },
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

describe('engine NotConfirmed', () => {
  it('NO at confirm enters NotConfirmed and choose:<sub> routes to sub', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990');
    expect(s.mode).toBe('ConfirmingMain');
    s = advance(s, 'no');
    expect(s.mode).toBe('NotConfirmed');
    s = advance(s, 'choose:month');
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('month');
  });

  it('NotConfirmed escalates up to 3 and then forces collecting missing', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990');
    expect(s.mode).toBe('ConfirmingMain');
    s = advance(s, 'no');
    expect(s.mode).toBe('NotConfirmed');
    s = advance(s, 'blah');
    s = advance(s, 'blah');
    s = advance(s, 'blah');
    expect(['CollectingSub', 'ConfirmingMain']).toContain(s.mode);
  });
});


