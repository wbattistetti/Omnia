import { describe, expect, it } from 'vitest';
import {
  buildRestructureFeedbackSnapshot,
  hasPendingRestructureFeedback,
  restructureRowKey,
  parseKbRestructureClarificationQuestions,
  answeredRestructureQuestions,
  allRestructureQuestionsAnswered,
  unansweredRestructureQuestions,
} from '../kbDocumentRestructureWorkflow';

describe('restructureRowKey', () => {
  const headers = ['code', 'label', 'entity_id'];

  it('prefers entity_id', () => {
    expect(restructureRowKey(headers, ['X', 'Visita', 'ent-42'], 0)).toBe('entity:ent-42');
  });

  it('falls back to code', () => {
    expect(restructureRowKey(['code', 'label'], ['ABC', 'Visita'], 0)).toBe('code:ABC');
  });

  it('falls back to row index', () => {
    expect(restructureRowKey(['foo'], ['—'], 3)).toBe('row:3');
  });
});

describe('parseKbRestructureClarificationQuestions', () => {
  it('parses valid questions', () => {
    const out = parseKbRestructureClarificationQuestions([
      { id: 'q1', text: 'Visita generale o specialistica?', relatedRowKeys: ['code:A'] },
      { text: '' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('q1');
    expect(out[0]?.relatedRowKeys).toEqual(['code:A']);
  });
});

describe('hasPendingRestructureFeedback', () => {
  it('is false when empty and no baseline', () => {
    expect(
      hasPendingRestructureFeedback(
        { rowNotes: {}, questions: [], designerFeedback: '' },
        undefined
      )
    ).toBe(false);
  });

  it('is true when row note added after baseline', () => {
    const baseline = buildRestructureFeedbackSnapshot({
      rowNotes: {},
      questions: [],
      designerFeedback: '',
    });
    expect(
      hasPendingRestructureFeedback(
        { rowNotes: { 'code:A': 'ambiguo' }, questions: [], designerFeedback: '' },
        baseline
      )
    ).toBe(true);
  });

  it('is false when snapshot matches applied', () => {
    const payload = {
      rowNotes: { 'code:A': 'nota' },
      questions: [{ id: 'q1', text: 'Q?', answer: 'Risposta' }],
      designerFeedback: 'osservazione',
    };
    const snap = buildRestructureFeedbackSnapshot(payload);
    expect(hasPendingRestructureFeedback(payload, snap)).toBe(false);
  });
});

describe('answeredRestructureQuestions', () => {
  it('returns only questions with non-empty answer', () => {
    const out = answeredRestructureQuestions([
      { id: 'q1', text: 'A?' },
      { id: 'q2', text: 'B?', answer: '  sì  ' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('q2');
  });
});

describe('unansweredRestructureQuestions', () => {
  it('returns questions without answer', () => {
    const out = unansweredRestructureQuestions([
      { id: 'q1', text: 'A?' },
      { id: 'q2', text: 'B?', answer: 'sì' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('q1');
  });
});

describe('allRestructureQuestionsAnswered', () => {
  it('is true when there are no questions', () => {
    expect(allRestructureQuestionsAnswered([])).toBe(true);
  });

  it('is false when any question lacks answer', () => {
    expect(
      allRestructureQuestionsAnswered([
        { id: 'q1', text: 'A?', answer: 'ok' },
        { id: 'q2', text: 'B?' },
      ])
    ).toBe(false);
  });

  it('is true when every question is answered', () => {
    expect(
      allRestructureQuestionsAnswered([
        { id: 'q1', text: 'A?', answer: 'ok' },
        { id: 'q2', text: 'B?', answer: 'sì' },
      ])
    ).toBe(true);
  });
});
