import { describe, expect, it } from 'vitest';
import {
  areAllUseCasesProjectable,
  compileUseCaseConversationalText,
  isUseCaseProjectable,
  projectAllUseCasesToConversationalJson,
  projectUseCaseToConversationalJson,
  stringifyUseCaseConversationalJson,
} from '../useCaseJsonProjection';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function makeUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Accettazione prima data',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'L’utente accetta la prima data proposta dall’agente.',
    dialogue: [
      {
        turn_id: 'turn-1',
        role: 'assistant',
        content:
          'Buongiorno, le propongo il [12 giugno] alle [09:00]. Confermo l’appuntamento?',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...overrides,
  };
}

describe('isUseCaseProjectable', () => {
  it('returns true for a use case with a non-empty canonical assistant example', () => {
    expect(isUseCaseProjectable(makeUseCase())).toBe(true);
  });

  it('returns false when canonical assistant example is missing', () => {
    const uc = makeUseCase({ dialogue: [] });
    expect(isUseCaseProjectable(uc)).toBe(false);
  });

  it('returns false when canonical assistant example is only whitespace', () => {
    const uc = makeUseCase({
      dialogue: [{ turn_id: 't', role: 'assistant', content: '   \n  ', editable: true }],
    });
    expect(isUseCaseProjectable(uc)).toBe(false);
  });
});

describe('compileUseCaseConversationalText', () => {
  it('compiles literal brackets from canonical text into runtime tokens', () => {
    const out = compileUseCaseConversationalText(makeUseCase());
    expect(out?.naturalText).toContain('[12 giugno]');
    expect(out?.tokenizedText).toBe(
      'Buongiorno, le propongo il [data] alle [orario]. Confermo l’appuntamento?'
    );
    expect(out?.tokens).toEqual(['data', 'orario']);
  });

  it('uses [slot] when a bracket cannot be inferred deterministically', () => {
    const out = compileUseCaseConversationalText(
      makeUseCase({
        dialogue: [
          {
            turn_id: 't',
            role: 'assistant',
            content: 'Saluto [Mario Rossi].',
            editable: true,
          },
        ],
      })
    );
    expect(out?.tokenizedText).toBe('Saluto [slot].');
    expect(out?.warnings.some((w) => w.includes('[slot]'))).toBe(true);
  });
});

describe('projectUseCaseToConversationalJson', () => {
  it('returns null when not projectable', () => {
    const uc = makeUseCase({ dialogue: [] });
    expect(projectUseCaseToConversationalJson(uc)).toBeNull();
  });

  it('projects label, scenario, tokenizedExample, and unique tokens in order', () => {
    const uc = makeUseCase({
      id: 'uc-x',
      label: 'Conferma slot',
      payoff: 'Scenario di conferma.',
      dialogue: [
        {
          turn_id: 'turn-x',
          role: 'assistant',
          content: 'Ciao [Mario Rossi], ti vedo il [12 giugno] alle [09:00] al [12 giugno].',
          editable: true,
        },
      ],
    });
    const out = projectUseCaseToConversationalJson(uc);
    expect(out).toEqual({
      useCaseId: 'uc-x',
      label: 'Conferma slot',
      scenario: 'Scenario di conferma.',
      tokenizedExample: 'Ciao [slot], ti vedo il [data1] alle [orario] al [data2].',
      tokens: ['slot', 'data1', 'orario', 'data2'],
    });
  });

  it('keeps numeric suffixes verbatim when the same base appears with different indices', () => {
    /**
     * `[data1]` e `[data2]` sono entità distinte (due date diverse nello stesso template):
     * dedup preserva entrambe, in ordine di prima apparizione.
     */
    const uc = makeUseCase({
      dialogue: [
        {
          turn_id: 't',
          role: 'assistant',
          content: 'Ho disponibile il [12 giugno] o in alternativa il [20 giugno].',
          editable: true,
        },
      ],
    });
    const out = projectUseCaseToConversationalJson(uc);
    expect(out?.tokens).toEqual(['data1', 'data2']);
  });

  it('trims label and scenario whitespace', () => {
    const uc = makeUseCase({
      label: '  Pulito  ',
      payoff: '  Scenario   ',
      dialogue: [{ turn_id: 't', role: 'assistant', content: 'Ciao [Mario].', editable: true }],
    });
    const out = projectUseCaseToConversationalJson(uc);
    expect(out?.label).toBe('Pulito');
    expect(out?.scenario).toBe('Scenario');
  });

  it('returns empty tokens array when tokenized example has no placeholders', () => {
    const uc = makeUseCase({
      dialogue: [
        { turn_id: 't', role: 'assistant', content: 'Buongiorno, come va?', editable: true },
      ],
    });
    const out = projectUseCaseToConversationalJson(uc);
    expect(out?.tokens).toEqual([]);
  });
});

describe('projectAllUseCasesToConversationalJson', () => {
  it('skips non-projectable use cases and preserves sort_order ascending', () => {
    const ucs: AIAgentUseCase[] = [
      makeUseCase({ id: 'uc-b', sort_order: 2 }),
      makeUseCase({ id: 'uc-a', sort_order: 1 }),
      makeUseCase({ id: 'uc-empty', sort_order: 0, dialogue: [] }),
    ];
    const out = projectAllUseCasesToConversationalJson(ucs);
    expect(out.map((o) => o.useCaseId)).toEqual(['uc-a', 'uc-b']);
  });

  it('breaks ties by label (case-insensitive)', () => {
    const ucs: AIAgentUseCase[] = [
      makeUseCase({ id: 'uc-z', label: 'Zeta', sort_order: 0 }),
      makeUseCase({ id: 'uc-a', label: 'alfa', sort_order: 0 }),
    ];
    const out = projectAllUseCasesToConversationalJson(ucs);
    expect(out.map((o) => o.useCaseId)).toEqual(['uc-a', 'uc-z']);
  });

  it('excludes use cases with included_in_conversations === false', () => {
    const ucs: AIAgentUseCase[] = [
      makeUseCase({ id: 'uc-in', sort_order: 1 }),
      makeUseCase({ id: 'uc-out', sort_order: 2, included_in_conversations: false }),
    ];
    const out = projectAllUseCasesToConversationalJson(ucs);
    expect(out.map((o) => o.useCaseId)).toEqual(['uc-in']);
  });

  it('treats missing included_in_conversations as included (backward-compat)', () => {
    const ucs: AIAgentUseCase[] = [
      makeUseCase({ id: 'uc-default', sort_order: 1 }),
      makeUseCase({ id: 'uc-true', sort_order: 2, included_in_conversations: true }),
    ];
    const out = projectAllUseCasesToConversationalJson(ucs);
    expect(out.map((o) => o.useCaseId)).toEqual(['uc-default', 'uc-true']);
  });
});

describe('areAllUseCasesProjectable', () => {
  it('returns false on empty list', () => {
    expect(areAllUseCasesProjectable([])).toBe(false);
  });

  it('returns true when all use cases are projectable', () => {
    expect(areAllUseCasesProjectable([makeUseCase(), makeUseCase({ id: 'uc-2' })])).toBe(true);
  });

  it('returns false if any single use case is not projectable', () => {
    expect(
      areAllUseCasesProjectable([
        makeUseCase(),
        makeUseCase({ id: 'uc-empty', dialogue: [] }),
      ])
    ).toBe(false);
  });

  it('ignores excluded use cases (included_in_conversations === false) for the check', () => {
    /**
     * Un use case escluso con dialogue vuoto NON deve invalidare il check: l'utente l'ha tolto
     * di mezzo consapevolmente, non partecipa al prompt finale.
     */
    expect(
      areAllUseCasesProjectable([
        makeUseCase(),
        makeUseCase({ id: 'uc-broken', dialogue: [], included_in_conversations: false }),
      ])
    ).toBe(true);
  });

  it('returns false when ALL use cases are excluded (nothing left to project)', () => {
    expect(
      areAllUseCasesProjectable([
        makeUseCase({ id: 'uc-1', included_in_conversations: false }),
        makeUseCase({ id: 'uc-2', included_in_conversations: false }),
      ])
    ).toBe(false);
  });
});

describe('stringifyUseCaseConversationalJson', () => {
  it('returns indented JSON for a projectable use case', () => {
    const out = stringifyUseCaseConversationalJson(makeUseCase());
    expect(out.startsWith('{\n  "useCaseId":')).toBe(true);
    expect(out.includes('"tokenizedExample"')).toBe(true);
  });

  it('returns empty string for a non-projectable use case', () => {
    const uc = makeUseCase({ dialogue: [] });
    expect(stringifyUseCaseConversationalJson(uc)).toBe('');
  });
});
