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
    expect(prompt).toContain('"label": "Accettazione"');
    expect(prompt).toContain('"scenario": "Conferma data."');
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
});
