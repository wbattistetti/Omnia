import { describe, expect, it } from 'vitest';
import { normalizeAnalyzeDebuggerTurnUseCaseResult } from '../analyzeDebuggerTurnUseCaseResult';

describe('normalizeAnalyzeDebuggerTurnUseCaseResult', () => {
  it('maps valid payload (nuovi outcome)', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({
      outcome: 'no_matching_use_case',
      summary_it: 'testo',
      recognized_use_case_id: null,
      recognized_use_case_label: null,
      suggested_use_case: {
        label: 'L',
        payoff: 'P',
        assistant_example_line: 'Ciao',
      },
    });
    expect(r.outcome).toBe('no_matching_use_case');
    expect(r.summary_it).toBe('testo');
    expect(r.recognized_use_case_id).toBeNull();
    expect(r.recognized_use_case_label).toBeNull();
    expect(r.correct_assistant_reply_it).toBeNull();
    expect(r.runtime_agent_use_case_id).toBeNull();
    expect(r.runtime_agent_use_case_label).toBeNull();
    expect(r.suggested_use_case?.assistant_example_line).toBe('Ciao');
  });

  it('maps correct_assistant_reply_it when present', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({
      outcome: 'exists_but_not_recognized',
      correct_assistant_reply_it: '  Certamente, alle 14  ',
    });
    expect(r.correct_assistant_reply_it).toBe('Certamente, alle 14');
  });

  it('accepts assistant_example alias', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({
      outcome: 'uncertain',
      suggested_use_case: { assistant_example: 'x', label: '', payoff: '' },
    });
    expect(r.suggested_use_case?.assistant_example_line).toBe('x');
  });

  it('defaults broken outcome to uncertain', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({ outcome: 'broken' });
    expect(r.outcome).toBe('uncertain');
  });

  it('maps legacy matched_wrong_response to exists_but_not_recognized', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({
      outcome: 'matched_wrong_response',
      summary_it: 'x',
    });
    expect(r.outcome).toBe('exists_but_not_recognized');
  });

  it('does not activate runtime_divergence without agent id', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({
      outcome: 'runtime_divergence',
      recognized_use_case_id: 'a',
      runtime_agent_use_case_id: null,
    });
    expect(r.outcome).toBe('uncertain');
  });

  it('keeps runtime_divergence when both ids differ', () => {
    const r = normalizeAnalyzeDebuggerTurnUseCaseResult({
      outcome: 'runtime_divergence',
      recognized_use_case_id: 'uc-a',
      runtime_agent_use_case_id: 'uc-b',
    });
    expect(r.outcome).toBe('runtime_divergence');
  });
});
