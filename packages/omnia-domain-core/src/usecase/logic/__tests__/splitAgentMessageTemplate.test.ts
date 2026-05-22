import { describe, it, expect } from 'vitest';
import {
  buildAgentMessageMotorPayload,
  splitAgentMessageBrackets,
} from '../splitAgentMessageTemplate';

describe('splitAgentMessageBrackets', () => {
  it('returns single text when no brackets', () => {
    expect(splitAgentMessageBrackets('Ciao')).toEqual([{ kind: 'text', text: 'Ciao' }]);
  });

  it('splits text and slots', () => {
    expect(splitAgentMessageBrackets('A [data] B [ora]')).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'slot', name: 'data', raw: '[data]' },
      { kind: 'text', text: ' B ' },
      { kind: 'slot', name: 'ora', raw: '[ora]' },
    ]);
  });

  it('trims inner slot names', () => {
    expect(splitAgentMessageBrackets('[ nome_utente ]')).toEqual([
      { kind: 'slot', name: 'nome_utente', raw: '[ nome_utente ]' },
    ]);
  });
});

describe('buildAgentMessageMotorPayload', () => {
  it('dedupes slot bindings by slot_id', () => {
    const p = buildAgentMessageMotorPayload({
      useCaseId: 'u1',
      label: 'L',
      template: '[x] e [x]',
    });
    expect(p.slots).toEqual([{ slot_id: 'x', surface: 'x' }]);
    expect(p.segments.filter((s) => s.kind === 'slot')).toHaveLength(2);
  });

  it('uses slotBindings for surfaces and includes groups + linear_semantic', () => {
    const p = buildAgentMessageMotorPayload({
      useCaseId: 'u1',
      label: 'L',
      template: 'Per [data_richiesta], disponibilità alle [ora_disponibile].',
      slotBindings: [
        { slot_id: 'data_richiesta', surface: 'sabato 21' },
        { slot_id: 'ora_disponibile', surface: '8' },
      ],
      groups: [
        {
          slot_id: 'ora_disponibile',
          values: ['8', '10', '17'],
          pattern: 'alle [ora]',
          separator: ', ',
          last_separator: ' e ',
        },
      ],
      linear_semantic: [{ text: 'per ', slot: 'data' }],
    });
    expect(p.slots).toEqual([
      { slot_id: 'data_richiesta', surface: 'sabato 21' },
      { slot_id: 'ora_disponibile', surface: '8' },
    ]);
    expect(p.groups).toEqual([
      {
        slot_id: 'ora_disponibile',
        values: ['8', '10', '17'],
        pattern: 'alle [ora]',
        separator: ', ',
        last_separator: ' e ',
      },
    ]);
    expect(p.linear_semantic).toEqual([{ text: 'per ', slot: 'data' }]);
  });
});
