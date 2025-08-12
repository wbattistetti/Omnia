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

describe('engine minimal modes', () => {
  it('happy path: full date -> confirm -> yes -> success -> next/completed', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990');
    expect(s.mode).toBe('ConfirmingMain');
    s = advance(s, 'yes');
    expect(s.mode).toBe('SuccessMain');
    s = advance(s, '');
    expect(s.mode === 'CollectingMain' || s.mode === 'Completed').toBe(true);
  });

  it('partial then sub collecting', () => {
    let s = initEngine(template);
    s = advance(s, '1990');
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day' /* month could be first depending on regex; allow either */);
  });

  it('confirm no -> go to sub collecting', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990');
    s = advance(s, 'no');
    expect(s.mode).toBe('CollectingSub');
  });
});


