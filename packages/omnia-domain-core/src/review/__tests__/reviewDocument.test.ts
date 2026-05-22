import { describe, expect, it } from 'vitest';
import {
  buildAgentReviewDocument,
  parseAgentReviewDocument,
  summarizeReviewDiff,
} from '../reviewDocument';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function minimalUc(id: string, payoff: string): AIAgentUseCase {
  return {
    id,
    label: id,
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff,
    dialogue: [
      { turn_id: 'u1', role: 'user', content: 'ciao' },
      { turn_id: 'a1', role: 'assistant', content: 'risposta' },
    ],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

describe('agentReviewChannel document', () => {
  it('round-trips parse after build', () => {
    const doc = buildAgentReviewDocument({
      projectId: 'p1',
      taskInstanceId: 't1',
      taskLabel: 'Agent',
      agentDesignDescription: 'desc',
      useCases: [minimalUc('a', 'scenario uno')],
      categories: [],
    });
    const parsed = parseAgentReviewDocument(doc);
    expect(parsed?.projectId).toBe('p1');
    expect(parsed?.useCaseBundle.use_cases).toHaveLength(1);
  });

  it('summarizeReviewDiff detects scenario change', () => {
    const local = {
      projectId: 'p1',
      taskInstanceId: 't1',
      taskLabel: '',
      agentDesignDescription: 'x',
      useCases: [minimalUc('a', 'old')],
      categories: [] as const,
    };
    const remote = buildAgentReviewDocument({
      ...local,
      useCases: [minimalUc('a', 'new text here')],
    });
    const diff = summarizeReviewDiff(local, remote);
    expect(diff.modifiedScenarioCount).toBeGreaterThan(0);
  });

  it('round-trips structured sections', () => {
    const doc = buildAgentReviewDocument({
      projectId: 'p1',
      taskInstanceId: 't1',
      taskLabel: 'Agent',
      agentDesignDescription: 'desc',
      useCases: [minimalUc('a', 'scenario uno')],
      categories: [],
      structuredSections: {
        goal: 'Aiutare il cliente',
        context: 'Call center',
      },
    });
    expect(doc.agentStructuredSections?.goal).toBe('Aiutare il cliente');
    const parsed = parseAgentReviewDocument(doc);
    expect(parsed?.agentStructuredSections?.context).toBe('Call center');
  });

  it('round-trips publish snapshots', () => {
    const doc = buildAgentReviewDocument({
      projectId: 'p1',
      taskInstanceId: 't1',
      taskLabel: 'Agent',
      agentDesignDescription: 'desc',
      useCases: [minimalUc('a', 'scenario uno')],
      categories: [],
      knowledgeBase: {
        documents: [
          {
            id: 'kb1',
            name: 'doc.txt',
            size: 10,
            mimeType: 'text/plain',
            addedAt: '2026-01-01T00:00:00.000Z',
            parseStatus: 'ready',
          },
        ],
      },
      conversation: {
        conversationalRules: [],
        styleAuto: false,
        styleSelections: {},
        globalStyleId: 'cortese',
        styleLearningNotes: 'note',
        deployStyleId: null,
      },
    });
    const parsed = parseAgentReviewDocument(doc);
    expect(parsed?.knowledgeBase?.documents[0]?.name).toBe('doc.txt');
    expect(parsed?.conversation?.globalStyleId).toBe('cortese');
  });
});
