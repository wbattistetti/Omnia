import { describe, it, expect } from 'vitest';
import { initEngine, advance } from '../engine';
import type { DDTTemplateV2 } from '../model/ddt.v2.types';
import type { DataContract } from '../contracts/contractLoader';

/** Minimal embedded contract so loadContract agrees with kind=date (grammarMissing checks). */
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
      steps: { ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] }, success: { base: ['ok'] }, confirm: { base: 'c', noInput: ['', '', ''], noMatch: ['', '', ''] } },
      subs: ['day', 'month', 'year'],
    } as any,
    { id: 'day', label: 'Day', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'month', label: 'Month', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
    { id: 'year', label: 'Year', type: 'sub', kind: 'generic', steps: { ask: { base: 'x', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] } } } as any,
  ],
};

describe('engine minimal modes', () => {
  it('happy path: full date -> confirm -> yes -> success -> next/completed', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990', { day: 12, month: 5, year: 1990 });
    expect(s.mode).toBe('ConfirmingMain');
    s = advance(s, 'yes');
    expect(s.mode).toBe('SuccessMain');
    s = advance(s, '');
    expect(s.mode === 'CollectingMain' || s.mode === 'Completed').toBe(true);
  });

  it('partial then sub collecting', () => {
    let s = initEngine(template);
    s = advance(s, '1990', { year: 1990 });
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');
  });

  it('confirm no -> go to NotConfirmed', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990', { day: 12, month: 5, year: 1990 });
    s = advance(s, 'no');
    expect(s.mode).toBe('NotConfirmed');
  });
});

describe('engine escalation', () => {
  it('noInput: empty input increments counter and shows recovery', () => {
    let s = initEngine(template);
    s = advance(s, '');
    expect(s.mode).toBe('CollectingMain');
    const nodeState = s.nodeStates['date'];
    expect(nodeState.counters.noInput).toBeGreaterThan(0);
  });

  it('multiple noInput: counter increments progressively', () => {
    let s = initEngine(template);
    s = advance(s, '');
    expect(s.nodeStates['date'].counters.noInput).toBe(1);
    s = advance(s, '');
    expect(s.nodeStates['date'].counters.noInput).toBe(2);
    s = advance(s, '');
    expect(s.nodeStates['date'].counters.noInput).toBe(3);
  });
});

describe('engine VB-shaped correction (no TS extraction)', () => {
  it('second turn supplies new month from VB payload', () => {
    let s = initEngine(template);
    s = advance(s, 'dicembre 1980', { month: 12, year: 1980 });
    expect(s.memory['year']?.value).toBe(1980);

    s = advance(s, 'no, è novembre', { month: 11 });
    expect(s.memory['month']?.value).toBe(11);
    expect(['CollectingMain', 'CollectingSub']).toContain(s.mode);
  });
});

describe('engine partial confirmation', () => {
  it('partial confirmation: "sì, il giorno è corretto ma l\'anno è 1981"', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990', { day: 12, month: 5, year: 1990 });
    expect(s.mode).toBe('ConfirmingMain');

    s = advance(s, 'sì, il giorno è corretto ma l\'anno è 1981');
    expect(['CollectingMain', 'CollectingSub', 'ConfirmingMain', 'NotConfirmed']).toContain(s.mode);
    expect(s.memory['day']?.value).toBe(12);
  });
});

describe('engine NotConfirmed flow', () => {
  it('NotConfirmed -> correction -> Normal', () => {
    let s = initEngine(template);
    s = advance(s, '12/05/1990', { day: 12, month: 5, year: 1990 });
    s = advance(s, 'no');
    expect(s.mode).toBe('NotConfirmed');

    s = advance(s, '18 maggio 1980', { day: 18, month: 5, year: 1980 });
    expect(s.mode).toBe('CollectingMain');
    expect(s.memory['day']?.value).toBe(18);
    expect(s.memory['month']?.value).toBe(5);
    expect(s.memory['year']?.value).toBe(1980);
  });
});

describe('engine ToComplete flow', () => {
  it('partial date -> ToComplete -> asks for missing sub', () => {
    let s = initEngine(template);
    s = advance(s, 'maggio 1980', { month: 5, year: 1980 });
    expect(s.memory['month']?.value).toBe(5);
    expect(s.memory['year']?.value).toBe(1980);
    expect(s.memory['day']?.value).toBeUndefined();

    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');
  });

  it('ToComplete: user message matches month only; stay on day', () => {
    let s = initEngine(template);
    s = advance(s, 'dicembre 1980', { month: 12, year: 1980 });
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');
    expect(s.memory['month']?.value).toBe(12);
    expect(s.memory['year']?.value).toBe(1980);
    expect(s.memory['day']?.value).toBeUndefined();

    s = advance(s, 'dicembre', { month: 12 });

    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');
    expect(s.memory['month']?.value).toBe(12);
    expect(s.memory['day']?.value).toBeUndefined();

    const dayState = s.nodeStates['day'];
    expect(dayState?.counters?.noMatch || 0).toBe(0);
  });

  it('ToComplete: user fills day+month; confirmation', () => {
    let s = initEngine(template);
    s = advance(s, 'dicembre 1980', { month: 12, year: 1980 });
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');

    s = advance(s, 'dicembre 12', { day: 12, month: 12 });

    expect(s.memory['day']?.value).toBe(12);
    expect(s.memory['month']?.value).toBe(12);
    expect(s.memory['year']?.value).toBe(1980);

    expect(s.mode).toBe('ConfirmingMain');
  });

  it('ToComplete: "16 dicembre" fills day+month -> year sub', () => {
    let s = initEngine(template);
    expect(s.mode).toBe('CollectingMain');
    expect(s.currentSubId).toBeUndefined();

    s = advance(s, '16 dicembre', { day: 16, month: 12 });

    expect(s.memory['day']?.value).toBe(16);
    expect(s.memory['month']?.value).toBe(12);
    expect(s.memory['year']?.value).toBeUndefined();

    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('year');

    const mainState = s.nodeStates['date'];
    expect(mainState?.step).toBe('Start');
  });

  it('ToComplete: noMatch on main when VB returns no match', () => {
    let s = initEngine(template);
    s = advance(s, 'dicembre 1980', { month: 12, year: 1980 });
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');

    s = advance(s, '!!!###$$$');

    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');

    const dateState = s.nodeStates['date'];
    expect(dateState?.counters?.noMatch || 0).toBeGreaterThan(0);

    const dayState = s.nodeStates['day'];
    expect(dayState?.counters?.noMatch || 0).toBe(0);
  });

  it('ToComplete: multiple noMatch increments main counter', () => {
    let s = initEngine(template);
    s = advance(s, 'dicembre 1980', { month: 12, year: 1980 });
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');

    s = advance(s, '!!!###$$$');
    expect(s.nodeStates['date']?.counters?.noMatch || 0).toBe(1);

    s = advance(s, '!!!###$$$');
    expect(s.nodeStates['date']?.counters?.noMatch || 0).toBe(2);

    s = advance(s, '!!!###$$$');
    expect(s.nodeStates['date']?.counters?.noMatch || 0).toBe(3);

    expect(s.currentSubId).toBe('day');

    const dayState = s.nodeStates['day'];
    expect(dayState?.counters?.noMatch || 0).toBe(0);
  });

  it('ToComplete: VB fixture fills day+month+year in one turn', () => {
    let s = initEngine(template);
    s = advance(s, 'dicembre 1980', { month: 12, year: 1980 });
    expect(s.mode).toBe('CollectingSub');
    expect(s.currentSubId).toBe('day');

    s = advance(s, '12 dicembre', { day: 12, month: 12, year: 1980 });

    expect(s.memory['day']?.value).toBe(12);
    expect(s.memory['month']?.value).toBe(12);
    expect(s.memory['year']?.value).toBe(1980);

    expect(s.mode).toBe('ConfirmingMain');
  });
});

describe('engine success without confirmation', () => {
  it('saturated data without confirmation step -> goes directly to Success', () => {
    const templateNoConfirm: DDTTemplateV2 = {
      schemaVersion: '2',
      metadata: { id: 'DDT_Simple', label: 'Simple' },
      nodes: [
        {
          id: 'name',
          label: 'Name',
          type: 'main',
          required: true,
          kind: 'name',
          dataContract: {
            templateName: 'name',
            templateId: 'test-name',
            subDataMapping: {},
            engines: [{ type: 'regex', enabled: true, patterns: ['.*'], examples: [] }],
            outputCanonical: { format: 'value' },
          },
          steps: { ask: { base: 'ask', reaskNoInput: ['', '', ''], reaskNoMatch: ['', '', ''] }, success: { base: ['ok'] } },
        } as any,
      ],
    };

    let s = initEngine(templateNoConfirm);
    s = advance(s, 'Mario Rossi', { value: 'Mario Rossi' });
    expect(s.mode).toBe('SuccessMain');
  });
});
