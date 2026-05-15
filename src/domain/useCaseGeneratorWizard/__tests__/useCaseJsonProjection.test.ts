import { describe, expect, it } from 'vitest';
import {
  areAllUseCasesProjectable,
  buildUseCaseLogValue,
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

  it('projects label, scenario, variants with tokenizedExample and tokens', () => {
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
    expect(out?.useCaseId).toBe('uc-x');
    expect(out?.variants).toHaveLength(1);
    expect(out?.variants[0].tokenizedExample).toBe(
      'Ciao [slot], ti vedo il [data1] alle [orario] al [data2].'
    );
    expect(out?.variants[0].tokens).toEqual(['slot', 'data1', 'orario', 'data2']);
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
    expect(out?.variants[0].tokens).toEqual(['data1', 'data2']);
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
    expect(out?.variants[0].tokens).toEqual([]);
  });

  it('omits structural variants with empty template (avoids duplicate default in variants[])', () => {
    const uc = makeUseCase({
      phrases: [
        {
          phraseId: 'ph-uc-1-0',
          naturalText: 'Ciao [Mario Rossi].',
          variants: [
            { variantId: 'default' },
            { variantId: 'structural_1', naturalText: '', when: 'draft' },
          ],
        },
      ],
    });
    const out = projectUseCaseToConversationalJson(uc);
    expect(out?.variants).toHaveLength(1);
    expect(out?.variants[0].variantId).toBe('default');
  });

  it('includes structural variant when it has its own non-empty template', () => {
    const uc = makeUseCase({
      phrases: [
        {
          phraseId: 'ph-uc-1-0',
          naturalText: 'Default [x].',
          variants: [
            { variantId: 'default' },
            {
              variantId: 'structural_1',
              naturalText: 'Alternativa [y].',
              when: 'retry',
            },
          ],
        },
      ],
    });
    const out = projectUseCaseToConversationalJson(uc);
    expect(out?.variants).toHaveLength(2);
    expect(out?.variants.map((v) => v.variantId)).toEqual(['default', 'structural_1']);
    expect(out?.variants[1].when).toBe('retry');
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

describe('buildUseCaseLogValue', () => {
  it('formats label as `USECASE: "<NOME>"` (MAIUSCOLO, virgolette doppie)', () => {
    expect(buildUseCaseLogValue('Saluto')).toBe('USECASE: "SALUTO"');
    expect(buildUseCaseLogValue('saluto cliente')).toBe('USECASE: "SALUTO CLIENTE"');
  });

  it('trims whitespace before applying upper-case', () => {
    expect(buildUseCaseLogValue('  Spazi  ')).toBe('USECASE: "SPAZI"');
  });

  it('preserves accented italian characters in upper-case', () => {
    /**
     * `toLocaleUpperCase()` standard ECMA su latin-1 non normalizza «più» → «PIÙ» con
     * accento? Sì, lo fa: le maiuscole accentate sono punti codice distinti. Importante
     * per non perdere informazione su label come «Più informazioni».
     */
    expect(buildUseCaseLogValue('Più informazioni')).toBe('USECASE: "PIÙ INFORMAZIONI"');
  });
});

describe('projectUseCaseToConversationalJson — log field', () => {
  it("by default does NOT include the 'log' field (back-compat with task gi\u00e0 pubblicati)", () => {
    const out = projectUseCaseToConversationalJson(makeUseCase());
    expect(out).not.toBeNull();
    expect(out!).not.toHaveProperty('log');
  });

  it("with includeLog=false explicitly: 'log' field is absent", () => {
    const out = projectUseCaseToConversationalJson(makeUseCase(), { includeLog: false });
    expect(out!).not.toHaveProperty('log');
  });

  it("with includeLog=true: 'log' is `USECASE: \"<NOME>\"` (label upper-cased, not GUID)", () => {
    const out = projectUseCaseToConversationalJson(
      makeUseCase({ id: 'uc-guid-xyz', label: 'Saluto cliente' }),
      { includeLog: true }
    );
    expect(out!.log).toBe('USECASE: "SALUTO CLIENTE"');
  });

  it('trims label whitespace before composing the log value', () => {
    const out = projectUseCaseToConversationalJson(
      makeUseCase({ label: '  Padded  ' }),
      { includeLog: true }
    );
    expect(out!.log).toBe('USECASE: "PADDED"');
  });
});

describe('projectAllUseCasesToConversationalJson — log field', () => {
  it('propagates includeLog to all projected entries', () => {
    const ucs: AIAgentUseCase[] = [
      makeUseCase({ id: 'uc-a', label: 'Alpha', sort_order: 1 }),
      makeUseCase({ id: 'uc-b', label: 'Beta', sort_order: 2 }),
    ];
    const withLog = projectAllUseCasesToConversationalJson(ucs, { includeLog: true });
    expect(withLog.map((o) => o.log)).toEqual([
      'USECASE: "ALPHA"',
      'USECASE: "BETA"',
    ]);
    const withoutLog = projectAllUseCasesToConversationalJson(ucs);
    expect(withoutLog.every((o) => !('log' in o))).toBe(true);
  });
});
