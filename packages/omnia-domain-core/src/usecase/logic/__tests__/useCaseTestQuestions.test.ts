import { describe, expect, it } from 'vitest';
import {
  appendUniqueTestQuestions,
  computeTestQuestionStats,
  findFirstTestQuestionAnchor,
  useCaseIdsWithTestQuestionStatus,
} from '../useCaseTestQuestions';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function uc(id: string, questions: AIAgentUseCase['testQuestions']): AIAgentUseCase {
  return {
    id,
    label: id,
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    dialogue: [],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
    testQuestions: questions,
  };
}

describe('useCaseTestQuestions', () => {
  it('computes dashboard percentages', () => {
    const stats = computeTestQuestionStats([
      uc('a', [
        { id: '1', text: 'q1', expectedAnswer: '', status: 'ok' },
        { id: '2', text: 'q2', expectedAnswer: '', status: 'ko' },
        { id: '3', text: 'q3', expectedAnswer: '', status: 'pending' },
      ]),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.reviewedPct).toBe(67);
    expect(stats.okPct).toBe(33);
    expect(stats.koPct).toBe(33);
  });

  it('finds use cases by status and first anchor', () => {
    const cases = [
      uc('a', [{ id: 'q1', text: 'x', expectedAnswer: '', status: 'ko' }]),
      uc('b', [{ id: 'q2', text: 'y', expectedAnswer: '', status: 'ok' }]),
    ];
    expect(useCaseIdsWithTestQuestionStatus(cases, 'ko')).toEqual(['a']);
    expect(findFirstTestQuestionAnchor(cases, ['a', 'b'], 'ok')).toEqual({
      useCaseId: 'b',
      questionId: 'q2',
    });
  });

  it('dedupes on append', () => {
    const merged = appendUniqueTestQuestions(
      [{ id: '1', text: 'Ciao mondo', expectedAnswer: '', status: 'pending' }],
      [{ id: '2', text: '  ciao   mondo ', expectedAnswer: '', status: 'pending' }]
    );
    expect(merged).toHaveLength(1);
  });
});
