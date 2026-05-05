import { describe, expect, it } from 'vitest';
import { BackendExecutionMode } from './backendTestRowTypes';
import { ensureMockTablePrefilledFromSendLiterals } from './ensureMockTablePrefilledFromSendLiterals';

describe('ensureMockTablePrefilledFromSendLiterals', () => {
  it('creates a row with SEND literals when table is empty', () => {
    const out = ensureMockTablePrefilledFromSendLiterals(
      [],
      ['agenda.type', 'agenda.url'],
      { 'agenda.type': 'Omnia', 'agenda.url': 'https://example.com/feed' },
      BackendExecutionMode.MOCK
    );
    expect(out.length).toBe(1);
    expect(out[0].inputs['agenda.type']).toBe('Omnia');
    expect(out[0].inputs['agenda.url']).toBe('https://example.com/feed');
  });

  it('does not create a row when empty literals', () => {
    const out = ensureMockTablePrefilledFromSendLiterals([], ['a', 'b'], {}, BackendExecutionMode.MOCK);
    expect(out).toEqual([]);
  });

  it('fills placeholder/empty cells from SEND literals; keeps real values', () => {
    const out = ensureMockTablePrefilledFromSendLiterals(
      [
        {
          id: 'r1',
          inputs: { 'agenda.type': 'empty', 'agenda.url': 'https://x' },
          outputs: {},
          testRun: { executionMode: BackendExecutionMode.MOCK, notes: {} },
        },
      ],
      ['agenda.type', 'agenda.url'],
      { 'agenda.type': 'Omnia' },
      BackendExecutionMode.MOCK
    );
    expect(out[0].inputs['agenda.url']).toBe('https://x');
    expect(out[0].inputs['agenda.type']).toBe('Omnia');
  });
});
