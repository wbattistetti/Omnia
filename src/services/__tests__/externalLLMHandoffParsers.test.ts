/**
 * Unit test per i parser del feature «LLM manual handoff».
 *
 * Coprono il path di applicazione della risposta esterna (motore LLM esterno):
 * - `parseExternalGenerateUseCasesJson`: payload generate_use_cases (replace + extend).
 * - `parseExternalAssembleConversationJson`: payload assemble_conversation.
 *
 * Single source of truth: i parser riusano gli stessi normalizer dei path interni
 * (`parseAgentUseCasesFromApi`, `parseConversationFromApi`), quindi qui validiamo solo
 * il livello di wrapping (extract from `conversation` nested, snake_case → camel, errori
 * espliciti su JSON non valido o forme corrotte).
 */
import { describe, it, expect } from 'vitest';
import {
  parseExternalGenerateUseCasesJson,
  parseExternalAssembleConversationJson,
} from '../aiAgentDesignApi';

describe('parseExternalGenerateUseCasesJson', () => {
  it('throws su input vuoto', () => {
    expect(() => parseExternalGenerateUseCasesJson('')).toThrow(/vuota/i);
    expect(() => parseExternalGenerateUseCasesJson('   ')).toThrow(/vuota/i);
  });

  it('throws su JSON non valido', () => {
    expect(() => parseExternalGenerateUseCasesJson('{not json}')).toThrow(/JSON non valido/i);
  });

  it('throws se non è un oggetto al livello superiore', () => {
    expect(() => parseExternalGenerateUseCasesJson('[1,2,3]')).toThrow(/use_cases/i);
  });

  it('throws se use_cases mancanti/vuoti', () => {
    expect(() => parseExternalGenerateUseCasesJson('{"use_cases":[]}')).toThrow(/use_cases/i);
  });

  it('throws se logical_steps mancanti in modalità replace', () => {
    const raw = JSON.stringify({
      use_cases: [
        {
          id: 'u1',
          label: 'Test',
          payoff: 'Scenario di prova',
          dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Ciao' }],
          parent_id: null,
          sort_order: 0,
          notes: { behavior: 'b', tone: 't' },
          bubble_notes: {},
        },
      ],
    });
    expect(() => parseExternalGenerateUseCasesJson(raw)).toThrow(/logical_steps/i);
  });

  it('parse OK replace: use_cases + logical_steps', () => {
    const raw = JSON.stringify({
      logical_steps: [{ id: 'ls1', description: 'Step uno' }],
      use_cases: [
        {
          id: 'u1',
          label: 'Test',
          payoff: 'Scenario di prova',
          dialogue: [{ turn_id: 't1', role: 'assistant', content: 'Ciao' }],
          parent_id: null,
          sort_order: 0,
          notes: { behavior: 'b', tone: 't' },
          bubble_notes: {},
        },
      ],
    });
    const out = parseExternalGenerateUseCasesJson(raw);
    expect(out.useCases.length).toBe(1);
    expect(out.useCases[0].id).toBe('u1');
    expect(out.logicalSteps?.length).toBe(1);
  });

  it('parse OK extend mode: solo use_cases, logical_steps=null', () => {
    const raw = JSON.stringify({
      use_cases: [
        {
          id: 'u2',
          label: 'Nuovo',
          payoff: 'Nuovo scenario',
          dialogue: [{ turn_id: 't2', role: 'assistant', content: 'Salve' }],
          parent_id: null,
          sort_order: 0,
          notes: { behavior: 'b', tone: 't' },
          bubble_notes: {},
        },
      ],
    });
    const out = parseExternalGenerateUseCasesJson(raw, { extendMode: true });
    expect(out.useCases.length).toBe(1);
    expect(out.logicalSteps).toBeNull();
  });
});

describe('parseExternalAssembleConversationJson', () => {
  const ctx = { outcome: 'positive' as const, allowsSuggestedUseCases: false };

  it('throws su input vuoto', () => {
    expect(() => parseExternalAssembleConversationJson('', ctx)).toThrow(/vuota/i);
  });

  it('throws su JSON non valido', () => {
    expect(() => parseExternalAssembleConversationJson('{broken}', ctx)).toThrow(/JSON non valido/i);
  });

  it('throws se non oggetto top-level', () => {
    expect(() => parseExternalAssembleConversationJson('"stringa"', ctx)).toThrow(/oggetto/i);
  });

  it('accetta payload root con turns', () => {
    const raw = JSON.stringify({
      conversation_id: 'c1',
      turns: [
        { turn_id: 'u-0', role: 'user', text: 'Vorrei un appuntamento.' },
        {
          turn_id: 'a-0',
          role: 'agent',
          text: 'Va bene martedì alle 10?',
          use_case_id: 'u1',
          use_case_label: 'Proposta',
        },
      ],
    });
    const conv = parseExternalAssembleConversationJson(raw, ctx);
    expect(conv.outcome).toBe('positive');
    expect(conv.allowsSuggestedUseCases).toBe(false);
    expect(conv.turns.length).toBeGreaterThanOrEqual(2);
  });

  it('accetta payload annidato { conversation: {...} }', () => {
    const raw = JSON.stringify({
      conversation: {
        conversation_id: 'c2',
        turns: [
          { turn_id: 'u-0', role: 'user', text: 'Domanda?' },
          {
            turn_id: 'a-0',
            role: 'agent',
            text: 'Risposta.',
            use_case_id: 'u1',
            use_case_label: 'Test',
          },
        ],
      },
    });
    const conv = parseExternalAssembleConversationJson(raw, ctx);
    expect(conv.turns.length).toBeGreaterThanOrEqual(2);
  });
});
