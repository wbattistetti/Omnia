import { describe, expect, it } from 'vitest';
import { createStepId, type DebuggerStep } from '../../core/DebuggerStep';
import { createInitialDebuggerSessionState } from '../../session/DebuggerSessionState';
import { applyDebuggerEvent } from '../applyDebuggerEvent';

function userStep(utterance: string): DebuggerStep {
  return {
    id: createStepId(),
    utterance,
    semanticValue: '',
    linguisticValue: '',
    grammar: { type: 'orchestrator', contract: 'GrammarFlow', elapsedMs: 0 },
    activeNodeId: 'n1',
    passedNodeIds: [],
    noMatchNodeIds: [],
    activeEdgeId: '',
    tags: ['user'],
  };
}

describe('applyDebuggerEvent', () => {
  it('SessionCleared resets timeline', () => {
    const s0 = createInitialDebuggerSessionState();
    const withStep = applyDebuggerEvent(s0, { type: 'UserTurnAppended', step: userStep('hi') });
    expect(withStep.steps.length).toBe(1);
    const cleared = applyDebuggerEvent(withStep, { type: 'SessionCleared' });
    expect(cleared.steps.length).toBe(0);
    expect(cleared.status).toBe('cleared');
  });

  it('NluPatchedForLastUserStep updates last user row', () => {
    let s = createInitialDebuggerSessionState();
    s = applyDebuggerEvent(s, { type: 'UserTurnAppended', step: userStep('x') });
    s = applyDebuggerEvent(s, {
      type: 'NluPatchedForLastUserStep',
      patch: { semanticValue: 'S', linguisticValue: 'L' },
    });
    expect(s.steps[0].semanticValue).toBe('S');
    expect(s.steps[0].linguisticValue).toBe('L');
  });
});
