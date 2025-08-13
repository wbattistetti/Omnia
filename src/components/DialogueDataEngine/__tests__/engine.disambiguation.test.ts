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
      steps: {
        ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] },
        success: { base: ['ok'] },
        confirm: { base: 'c', noInput: ['', '', ''], noMatch: ['', '', ''] },
        disambiguation: { prompt: 'choose', softRanking: true, defaultWithCancel: true, selectionMode: 'numbers' },
      },
      subs: ['day', 'month', 'year'],
    },
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

describe('engine implicit confirmation / disambiguation scaffolding', () => {
  it('implicit correction: not X but Y triggers re-parse and confirm', () => {
    let s = initEngine(template);
    s = advance(s, 'not 11/05/1990 but 12/05/1990');
    expect(['ConfirmingMain', 'CollectingSub']).toContain(s.mode);
  });

  it('extracts last date in a noisy input and progresses', () => {
    let s = initEngine(template);
    s = advance(s, 'I thought 10-01-1990, no, 12-02-1991 is correct');
    expect(['ConfirmingMain', 'CollectingSub']).toContain(s.mode);
  });
});


