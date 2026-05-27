import { describe, expect, it } from 'vitest';
import { buildConversationalPrompt } from '../buildConversationalPrompt';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function makeUseCase(overrides: Partial<AIAgentUseCase> = {}): AIAgentUseCase {
  return {
    id: 'uc-1',
    label: 'Use case A',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: 'Scenario di esempio.',
    dialogue: [
      {
        turn_id: 'turn-1',
        role: 'assistant',
        content: 'Ciao [Mario], ti propongo il [12 giugno].',
        editable: true,
      },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    ...overrides,
  };
}

describe('buildConversationalPrompt', () => {
  it('throws on empty input', () => {
    expect(() => buildConversationalPrompt([])).toThrow(/catalogo use case è vuoto/);
  });

  it('throws when at least one use case has no canonical assistant message', () => {
    expect(() =>
      buildConversationalPrompt([
        makeUseCase(),
        makeUseCase({ id: 'uc-2', dialogue: [] }),
      ])
    ).toThrow(/non ha un messaggio agente canonico/);
  });

  it('contains the operative header in IT', () => {
    const prompt = buildConversationalPrompt([makeUseCase()]);
    expect(prompt).toMatch(/^Ruolo/);
    expect(prompt).toContain('Regole obbligatorie');
    expect(prompt).toContain('Catalogo use case (JSON)');
  });

  it('emits a JSON block per use case with structural fields only (no plaintext duplicate)', () => {
    const prompt = buildConversationalPrompt([
      makeUseCase({
        id: 'uc-a',
        label: 'Accettazione',
        payoff: 'Conferma data.',
        dialogue: [
          {
            turn_id: 't-a',
            role: 'assistant',
            content: 'Ti vedo il [12 giugno].',
            editable: true,
          },
        ],
      }),
    ]);

    expect(prompt).toContain('### Use case 1');
    expect(prompt).toContain('"useCaseId": "uc-a"');
    expect(prompt).toContain('"scenario": "Conferma data."');
    expect(prompt).toContain('"variants"');
    expect(prompt).toContain('"tokenizedExample": "Ti vedo il [data]."');
    expect(prompt).toContain('"tokens": [');
    /**
     * CRUCIALE — la frase tokenizzata NON deve apparire come campo testuale separato fuori
     * dal JSON: il motore esterno deve leggerla SOLO dal JSON per evitare di trattarla come
     * doppia fonte. Se il refactor reintroduce «Frase tokenizzata: …» questo test fallisce.
     */
    expect(prompt).not.toMatch(/Frase tokenizzata\s*:/);
    /** Nessun esempio compilato che potrebbe ancorare il motore a un valore specifico. */
    expect(prompt).not.toMatch(/Frase di esempio\s*:/);
  });

  it('orders use cases by sort_order ascending', () => {
    const prompt = buildConversationalPrompt([
      makeUseCase({ id: 'uc-second', sort_order: 2 }),
      makeUseCase({ id: 'uc-first', sort_order: 1 }),
    ]);
    const firstIndex = prompt.indexOf('"useCaseId": "uc-first"');
    const secondIndex = prompt.indexOf('"useCaseId": "uc-second"');
    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
    expect(prompt).toContain('### Use case 1');
    expect(prompt).toContain('### Use case 2');
  });

  it('is deterministic: same input → same output', () => {
    const ucs = [makeUseCase(), makeUseCase({ id: 'uc-2', sort_order: 1 })];
    expect(buildConversationalPrompt(ucs)).toBe(buildConversationalPrompt(ucs));
  });

  describe('includeLog option', () => {
    /**
     * Quando `includeLog` è OFF (default) non DEVE comparire nessuna istruzione di logging
     * né nessun campo `"log":` nel JSON: i task pubblicati senza il toggle attivo si
     * affidano al "vecchio" prompt e l'output deve restare bit-identico.
     */
    it("by default omits both the textual instruction and the JSON 'log' field", () => {
      const prompt = buildConversationalPrompt([
        makeUseCase({ id: 'uc-a', label: 'Saluto' }),
      ]);
      expect(prompt).not.toContain('Logging use case');
      expect(prompt).not.toContain('"log"');
      expect(prompt).toContain('USECASE: "UKS"');
    });

    it("with includeLog=true: each JSON entry has 'log' with number and label", () => {
      const prompt = buildConversationalPrompt(
        [makeUseCase({ id: 'uc-a', label: 'Saluto cliente' })],
        { includeLog: true, catalogFormat: 'json-pretty' }
      );
      expect(prompt).toContain('"log": "USECASE: \\"1 — SALUTO CLIENTE\\""');
    });

    it('with includeLog=true: textual instruction is injected in front of the catalog blocks (not the global header)', () => {
      const prompt = buildConversationalPrompt(
        [makeUseCase({ id: 'uc-a', label: 'Saluto' })],
        { includeLog: true }
      );
      const headerIdx = prompt.indexOf('Catalogo use case (JSON)');
      const instructionIdx = prompt.indexOf('Logging use case');
      const firstBlockIdx = prompt.indexOf('### Use case 1');
      expect(headerIdx).toBeGreaterThan(-1);
      expect(instructionIdx).toBeGreaterThan(headerIdx);
      expect(firstBlockIdx).toBeGreaterThan(instructionIdx);
      /**
       * Lo snippet di esempio per il caso "non riconosciuto" deve usare il prefisso
       * `NUOVO_` (MAIUSCOLO) per essere distinguibile a colpo d'occhio dai trace dei
       * use case censiti, e racchiudere il nome in virgolette doppie.
       */
      expect(prompt).toMatch(/USECASE:\s*"NUOVO_/);
    });

    it('is deterministic also with includeLog=true', () => {
      const ucs = [makeUseCase(), makeUseCase({ id: 'uc-2', sort_order: 1 })];
      expect(buildConversationalPrompt(ucs, { includeLog: true })).toBe(
        buildConversationalPrompt(ucs, { includeLog: true })
      );
    });
  });

  it('dsl-standard uses DSL catalog heading and SAY blocks', () => {
    const prompt = buildConversationalPrompt(
      [
        makeUseCase({
          scenario: { descrittivo: 'x', llm: 'PRENOTAZIONE|data' },
          dialogue: [
            {
              turn_id: 't',
              role: 'assistant',
              content: 'Ti vedo il [12 giugno].',
              editable: true,
            },
          ],
        }),
      ],
      { catalogFormat: 'dsl-standard' }
    );
    expect(prompt).toContain('Catalogo use case (DSL)');
    expect(prompt).toContain('[1] PRENOTAZIONE|data');
    expect(prompt).toContain('>');
  });

  it('json-compact is shorter than json-pretty for the same catalog', () => {
    const ucs = [makeUseCase(), makeUseCase({ id: 'uc-2', sort_order: 1 })];
    const pretty = buildConversationalPrompt(ucs, { catalogFormat: 'json-pretty' });
    const compact = buildConversationalPrompt(ucs, { catalogFormat: 'json-compact' });
    expect(compact.length).toBeLessThan(pretty.length);
  });

  it('appends conversational rules section when provided', () => {
    const prompt = buildConversationalPrompt([makeUseCase()], {
      conversationalRules: [
        {
          id: 'cr-1',
          libraryRuleId: 'lib-dati-mancanti',
          label: 'Dati mancanti',
          scenario: 'Chiedi solo ciò che manca.',
          exampleMessage: 'Mi serve ancora [dato].',
          sort_order: 0,
        },
      ],
    });
    expect(prompt).toContain('Regole conversazionali');
    expect(prompt).toContain('Dati mancanti');
    expect(prompt).toContain('### Regola 1');
  });
});
