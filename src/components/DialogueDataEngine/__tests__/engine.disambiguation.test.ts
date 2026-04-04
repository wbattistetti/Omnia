import { describe, it, expect } from 'vitest';
import { initEngine, advance } from '../engine';
import type { DDTTemplateV2 } from '../model/ddt.v2.types';
import type { DataContract } from '../contracts/contractLoader';

const dateMainContract: DataContract = {
  templateName: 'date',
  templateId: 'test-date',
  subDataMapping: {
    day: { groupName: 'day', label: 'Day', type: 'number' },
    month: { groupName: 'month', label: 'Month', type: 'number' },
    year: { groupName: 'year', label: 'Year', type: 'number' },
  },
  engines: [{ type: 'regex', enabled: true, patterns: ['.*'], examples: [] }],
  outputCanonical: { format: 'object', keys: ['day', 'month', 'year'] },
};

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
      dataContract: dateMainContract,
      steps: {
        ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] },
        success: { base: ['ok'] },
        confirm: { base: 'c', noInput: ['', '', ''], noMatch: ['', '', ''] },
        disambiguation: { prompt: 'choose', softRanking: true, defaultWithCancel: true, selectionMode: 'numbers' },
      },
      subs: ['day', 'month', 'year'],
    } as any,
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

describe('engine disambiguation scaffolding (VB payload only)', () => {
  it('noisy utterance resolved via VB-shaped map', () => {
    let s = initEngine(template);
    s = advance(s, 'not 11/05/1990 but 12/05/1990', { day: 12, month: 5, year: 1990 });
    expect(['ConfirmingMain', 'CollectingSub']).toContain(s.mode);
  });

  it('long noisy input resolved via VB-shaped map', () => {
    let s = initEngine(template);
    s = advance(s, 'I thought 10-01-1990, no, 12-02-1991 is correct', { day: 12, month: 2, year: 1991 });
    expect(['ConfirmingMain', 'CollectingSub']).toContain(s.mode);
  });
});
