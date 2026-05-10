import { describe, expect, it } from 'vitest';
import type { AnalyzeDebuggerTurnUseCaseResult } from '@domain/aiAgentDebugger/analyzeDebuggerTurnUseCaseResult';
import { resolveDebuggerPrefillCorrectReply } from '../debuggerAssistCatalogHelpers';

const mockTask = {
  agentUseCasesJson: JSON.stringify([
    {
      id: 'uc-1',
      label: 'Chiedere orari',
      payoff: 'Contesto',
      parent_id: null,
      sort_order: 0,
      refinement_prompt: '',
      style_id: 'cortese',
      dialogue: [
        {
          turn_id: 't1',
          role: 'assistant',
          content: 'Battuta dal catalogo',
          editable: true,
        },
      ],
      notes: { behavior: '', tone: '' },
      bubble_notes: {},
    },
  ]),
};

function baseData(
  patch: Partial<AnalyzeDebuggerTurnUseCaseResult>
): AnalyzeDebuggerTurnUseCaseResult {
  return {
    outcome: 'use_case_recognized',
    summary_it: '',
    recognized_use_case_id: null,
    recognized_use_case_label: null,
    correct_assistant_reply_it: null,
    suggested_use_case: null,
    runtime_agent_use_case_id: null,
    runtime_agent_use_case_label: null,
    ...patch,
  };
}

describe('resolveDebuggerPrefillCorrectReply', () => {
  it('prefers catalog assistant turn when recognized_use_case_id matches', () => {
    const r = resolveDebuggerPrefillCorrectReply(mockTask as never, baseData({
      outcome: 'use_case_recognized',
      recognized_use_case_id: 'uc-1',
      correct_assistant_reply_it: 'Solo IA',
    }));
    expect(r).toBe('Battuta dal catalogo');
  });

  it('falls back to IA when catalog dialogue empty', () => {
    const r = resolveDebuggerPrefillCorrectReply(mockTask as never, baseData({
      outcome: 'exists_but_not_recognized',
      recognized_use_case_id: 'missing-id',
      correct_assistant_reply_it: 'Fallback IA',
    }));
    expect(r).toBe('Fallback IA');
  });

  it('uses suggested line when no recognized id', () => {
    const r = resolveDebuggerPrefillCorrectReply(null, baseData({
      outcome: 'no_matching_use_case',
      recognized_use_case_id: null,
      correct_assistant_reply_it: null,
      suggested_use_case: {
        label: 'Nuovo',
        payoff: 'p',
        assistant_example_line: 'Suggerito',
      },
    }));
    expect(r).toBe('Suggerito');
  });
});
