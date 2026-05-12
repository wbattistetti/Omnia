import { describe, expect, it } from 'vitest';
import {
  parseUseCaseWizardPersistedState,
  serializeUseCaseWizardPersistedState,
  USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
} from '../useCaseWizardPersistedState';
import type { UseCaseGeneratorWizardConversation } from '../types';

describe('parseUseCaseWizardPersistedState', () => {
  it('migrates schema v1 five-step indices to four-step layout', () => {
    const v = {
      schemaVersion: 1,
      enabled: true,
      stepIndex: 2,
      unlockedMaxStepIndex: 3,
      useCaseListBaseline: '[{"id":"a"}]',
      examplePhraseBaselineById: { a: 'hello' },
    };
    const raw = JSON.stringify(v);
    const p = parseUseCaseWizardPersistedState(raw);
    expect(p?.schemaVersion).toBe(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION);
    expect(p?.stepIndex).toBe(1);
    expect(p?.unlockedMaxStepIndex).toBe(2);
    expect(p?.useCaseListBaseline).toBe('[{"id":"a"}]');
    expect(p?.examplePhraseBaselineById?.a).toBe('hello');
  });

  it('parses legacy sessionStorage shape without schemaVersion and migrates indices', () => {
    const raw = JSON.stringify({ enabled: false, stepIndex: 1, unlockedMaxStepIndex: 2 });
    const p = parseUseCaseWizardPersistedState(raw);
    expect(p?.schemaVersion).toBe(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION);
    expect(p?.stepIndex).toBe(1);
    expect(p?.unlockedMaxStepIndex).toBe(1);
    expect(p?.enabled).toBe(false);
  });

  it('clamps schema v2 indices to current pipeline cap (3 step, max=2) and drops missing conversation fields', () => {
    /**
     * v2..v5 erano pipeline 4-step (cap = 3). v6 è 3-step (cap = 2). Un payload v2 con
     * `stepIndex: 3` (passo JSON, ora rimosso) viene clampato a 2 (tokenization) — è
     * esattamente il comportamento atteso: il designer riapre il task e si trova all'ultimo
     * step della nuova pipeline.
     */
    const raw = JSON.stringify({
      schemaVersion: 2,
      enabled: true,
      stepIndex: 3,
      unlockedMaxStepIndex: 3,
      useCaseListBaseline: 'x',
    });
    const p = parseUseCaseWizardPersistedState(raw);
    expect(p?.stepIndex).toBe(2);
    expect(p?.unlockedMaxStepIndex).toBe(2);
    expect(p?.conversations).toBeUndefined();
  });

  it('round-trip serialize at current schema version', () => {
    const v = {
      schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
      enabled: true,
      stepIndex: 0,
      unlockedMaxStepIndex: 1,
      useCaseListBaseline: 'x',
    };
    const s = serializeUseCaseWizardPersistedState(v);
    const p = parseUseCaseWizardPersistedState(s);
    expect(p?.useCaseListBaseline).toBe('x');
    expect(p?.schemaVersion).toBe(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION);
  });

  describe('schema v4: conversations + outcome + suggestion lifecycle', () => {
    const conversation: UseCaseGeneratorWizardConversation = {
      conversationId: 'c1',
      outcome: 'positive',
      turns: [
        { turnId: 't1', role: 'user', text: 'Vorrei prenotare' },
        {
          turnId: 't2',
          role: 'agent',
          useCaseId: 'uc-1',
          useCaseLabel: 'Prenotazione',
          text: 'Ti propongo alle [ora].',
        },
      ],
    };

    it('round-trips conversations + activeConversationId + baseline and drops legacy conversationsView', () => {
      /**
       * v6: il toggle Riga 2 «usecases/conversazioni» è stato rimosso. Payload pre-v6 con
       * `conversationsView` restano leggibili (tollerati silenziosamente) ma il campo NON è più
       * presente nell'output del parser. Vedi commento header `useCaseWizardPersistedState.ts`.
       */
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        enabled: true,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [conversation],
        activeConversationId: 'c1',
        conversationsView: 'conversazioni',
        conversationAgentBaselineByKey: { 'c1::t2': 'Ti propongo alle [ora].' },
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.conversations).toHaveLength(1);
      expect(p?.conversations?.[0].conversationId).toBe('c1');
      expect(p?.conversations?.[0].turns).toHaveLength(2);
      expect(p?.conversations?.[0].outcome).toBe('positive');
      expect(p?.activeConversationId).toBe('c1');
      expect((p as Record<string, unknown> | null)?.conversationsView).toBeUndefined();
      expect(p?.conversationAgentBaselineByKey?.['c1::t2']).toBe('Ti propongo alle [ora].');
    });

    it('drops legacy v4 toolbar selection fields (pendingConversation*) on read', () => {
      /**
       * Backward-compat: payload salvato da una variante intermedia di v4 che ancora persisteva la
       * selezione corrente della toolbar (Outcome + Lampadina). Adesso la scelta è fatta tramite i
       * 3 pulsanti contestuali nel pannello DX e non ha più uno stato persistente.
       */
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [conversation],
        activeConversationId: 'c1',
        pendingConversationOutcome: 'negative',
        pendingConversationAllowSuggested: true,
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.conversations).toHaveLength(1);
      expect(p?.activeConversationId).toBe('c1');
      // I campi legacy non sono più nello shape di output:
      expect((p as Record<string, unknown> | null)?.pendingConversationOutcome).toBeUndefined();
      expect((p as Record<string, unknown> | null)?.pendingConversationAllowSuggested).toBeUndefined();
    });

    it('round-trips agent turn with suggestion `pending`', () => {
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [
          {
            conversationId: 'c1',
            outcome: 'positive',
            allowsSuggestedUseCases: true,
            turns: [
              { turnId: 't1', role: 'user', text: 'ciao' },
              {
                turnId: 't2',
                role: 'agent',
                useCaseId: 'suggested:abc',
                useCaseLabel: 'Scenario emergente',
                text: 'Risposta emergente',
                suggestion: { status: 'pending', proposedLabel: 'Scenario emergente' },
              },
            ],
          },
        ],
      });
      const p = parseUseCaseWizardPersistedState(raw);
      const agent = p?.conversations?.[0].turns?.[1];
      expect(agent?.role).toBe('agent');
      if (agent && agent.role === 'agent') {
        expect(agent.useCaseId).toBe('suggested:abc');
        expect(agent.suggestion?.status).toBe('pending');
        expect(agent.suggestion?.proposedLabel).toBe('Scenario emergente');
      }
    });

    it('drops invalid suggestion.status', () => {
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [
          {
            conversationId: 'c1',
            outcome: 'positive',
            turns: [
              { turnId: 't1', role: 'user', text: 'ciao' },
              {
                turnId: 't2',
                role: 'agent',
                useCaseId: 'uc1',
                useCaseLabel: 'X',
                text: 'y',
                suggestion: { status: 'unknown', proposedLabel: 'Z' },
              },
            ],
          },
        ],
      });
      const p = parseUseCaseWizardPersistedState(raw);
      const agent = p?.conversations?.[0].turns?.[1];
      if (agent && agent.role === 'agent') {
        expect(agent.suggestion).toBeUndefined();
      }
    });

    it('round-trips scenarioSummary trimming whitespace and capping length', () => {
      const longSummary = 'Il paziente accetta dopo due rifiuti. '.repeat(20);
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [
          {
            conversationId: 'c1',
            outcome: 'positive',
            scenarioSummary: `   ${longSummary}   `,
            turns: [
              { turnId: 't1', role: 'user', text: 'ok' },
              { turnId: 't2', role: 'agent', useCaseId: 'u', useCaseLabel: 'L', text: 't' },
            ],
          },
        ],
      });
      const p = parseUseCaseWizardPersistedState(raw);
      const summary = p?.conversations?.[0].scenarioSummary;
      expect(typeof summary).toBe('string');
      expect(summary?.length ?? 0).toBeGreaterThan(0);
      expect(summary?.length ?? 0).toBeLessThanOrEqual(400);
      expect(summary?.startsWith(' ')).toBe(false);
    });

    it('omits scenarioSummary when missing or empty (backward-compat)', () => {
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [
          {
            conversationId: 'c1',
            outcome: 'positive',
            turns: [
              { turnId: 't1', role: 'user', text: 'ok' },
              { turnId: 't2', role: 'agent', useCaseId: 'u', useCaseLabel: 'L', text: 't' },
            ],
          },
          {
            conversationId: 'c2',
            outcome: 'negative',
            scenarioSummary: '   ',
            turns: [
              { turnId: 't3', role: 'user', text: 'ok' },
              { turnId: 't4', role: 'agent', useCaseId: 'u', useCaseLabel: 'L', text: 't' },
            ],
          },
        ],
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.conversations?.[0].scenarioSummary).toBeUndefined();
      expect(p?.conversations?.[1].scenarioSummary).toBeUndefined();
    });

    it('drops activeConversationId when it does not match any conversation', () => {
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [conversation],
        activeConversationId: 'unknown',
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.activeConversationId).toBeUndefined();
    });

    it('rejects agent turns without useCaseId during parse', () => {
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [
          {
            conversationId: 'c2',
            outcome: 'positive',
            turns: [
              { turnId: 't1', role: 'user', text: 'ciao' },
              { turnId: 't2', role: 'agent', text: 'risposta senza useCaseId' },
            ],
          },
        ],
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.conversations?.[0].turns).toHaveLength(1);
      expect(p?.conversations?.[0].turns[0].role).toBe('user');
    });

    it('drops legacy conversationsView regardless of value (rimosso in v6)', () => {
      /** Sia stringhe valide legacy («usecases», «conversazioni») che valori spazzatura sono ignorati. */
      for (const value of ['usecases', 'conversazioni', 'whatever', 42, null]) {
        const raw = JSON.stringify({
          schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
          stepIndex: 1,
          unlockedMaxStepIndex: 1,
          conversationsView: value,
        });
        const p = parseUseCaseWizardPersistedState(raw);
        expect((p as Record<string, unknown> | null)?.conversationsView).toBeUndefined();
      }
    });

    it('migrates legacy v3 conversation without outcome to positive default', () => {
      const raw = JSON.stringify({
        schemaVersion: 3,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
        conversations: [
          {
            conversationId: 'cLegacy',
            turns: [
              { turnId: 't1', role: 'user', text: 'ciao' },
              {
                turnId: 't2',
                role: 'agent',
                useCaseId: 'uc1',
                useCaseLabel: 'X',
                text: 'y',
              },
            ],
          },
        ],
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.schemaVersion).toBe(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION);
      expect(p?.conversations?.[0].outcome).toBe('positive');
      expect(p?.conversations?.[0].allowsSuggestedUseCases).toBe(false);
    });
  });

  describe('schema v5: tokenization baseline (passo 3)', () => {
    it('round-trips tokenizationBaselineByUseCaseId', () => {
      const v = {
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 2,
        unlockedMaxStepIndex: 2,
        tokenizationBaselineByUseCaseId: {
          'uc-1': 'Ti propongo [data] alle [ora].',
          'uc-2': 'Ho disponibile [data1] o [data2].',
        },
      };
      const s = serializeUseCaseWizardPersistedState(v);
      const p = parseUseCaseWizardPersistedState(s);
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-1']).toBe('Ti propongo [data] alle [ora].');
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-2']).toBe('Ho disponibile [data1] o [data2].');
    });

    it('omits tokenizationBaselineByUseCaseId when missing (backward-compat v4 payload)', () => {
      /**
       * Payload v4 senza il nuovo campo: deve restare leggibile e produrre output senza
       * `tokenizationBaselineByUseCaseId` (default `undefined`).
       */
      const raw = JSON.stringify({
        schemaVersion: 4,
        stepIndex: 1,
        unlockedMaxStepIndex: 1,
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.tokenizationBaselineByUseCaseId).toBeUndefined();
    });

    it('drops non-string entries in tokenizationBaselineByUseCaseId', () => {
      const raw = JSON.stringify({
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        stepIndex: 2,
        unlockedMaxStepIndex: 2,
        tokenizationBaselineByUseCaseId: {
          'uc-good': 'Ciao [nome].',
          'uc-bad': 42,
          'uc-also-bad': null,
        },
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-good']).toBe('Ciao [nome].');
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-bad']).toBeUndefined();
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-also-bad']).toBeUndefined();
    });
  });

  describe('schema v6: pipeline ridotta da 4 a 3 step (rimosso json_generation)', () => {
    it('current schema version is 6', () => {
      expect(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION).toBe(6);
    });

    it('clamps v5 stepIndex=3 (json) to 2 (tokenization)', () => {
      /** Designer su step JSON al momento del salvataggio: dopo upgrade torna su tokenization. */
      const raw = JSON.stringify({
        schemaVersion: 5,
        stepIndex: 3,
        unlockedMaxStepIndex: 3,
        tokenizationBaselineByUseCaseId: { 'uc-1': 'Ciao [nome].' },
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.schemaVersion).toBe(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION);
      expect(p?.stepIndex).toBe(2);
      expect(p?.unlockedMaxStepIndex).toBe(2);
      /** I dati di tokenizzazione restano: campo opzionale forward-compat. */
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-1']).toBe('Ciao [nome].');
    });

    it('clamps v5 unlockedMaxStepIndex=3 alone, leaving lower stepIndex untouched', () => {
      const raw = JSON.stringify({
        schemaVersion: 5,
        stepIndex: 1,
        unlockedMaxStepIndex: 3,
      });
      const p = parseUseCaseWizardPersistedState(raw);
      expect(p?.stepIndex).toBe(1);
      expect(p?.unlockedMaxStepIndex).toBe(2);
    });

    it('round-trips a v6 payload without losing fields', () => {
      const v = {
        schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
        enabled: true,
        stepIndex: 2,
        unlockedMaxStepIndex: 2,
        useCaseListBaseline: 'baseline-list',
        tokenizationBaselineByUseCaseId: { 'uc-1': 'Hello [nome].' },
      };
      const s = serializeUseCaseWizardPersistedState(v);
      const p = parseUseCaseWizardPersistedState(s);
      expect(p?.schemaVersion).toBe(USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION);
      expect(p?.stepIndex).toBe(2);
      expect(p?.unlockedMaxStepIndex).toBe(2);
      expect(p?.useCaseListBaseline).toBe('baseline-list');
      expect(p?.tokenizationBaselineByUseCaseId?.['uc-1']).toBe('Hello [nome].');
    });

    it('rejects future schema versions (>6) returning null', () => {
      const raw = JSON.stringify({
        schemaVersion: 99,
        stepIndex: 0,
        unlockedMaxStepIndex: 0,
      });
      expect(parseUseCaseWizardPersistedState(raw)).toBeNull();
    });
  });
});
