/**
 * Tests for AI Agent task snapshot helpers.
 */

import { describe, expect, it } from 'vitest';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentTaskSnapshot } from './buildTaskSnapshot';
import { resolveHasAgentGeneration } from './buildTaskSnapshot';

const oneProposed: AIAgentProposedVariable = {
  slotId: '11111111-1111-4111-8111-111111111111',
  label: 'Nome',
  type: 'string',
  required: true,
};

function baseSnapshot(over: Partial<AIAgentTaskSnapshot>): AIAgentTaskSnapshot {
  return {
    agentDesignDescription: '',
    agentPrompt: '',
    agentPromptTargetPlatform: '',
    agentStructuredSectionsJson: '',
    outputVariableMappings: {},
    agentProposedFields: [],
    agentSampleDialogue: [],
    agentInitialStateTemplateJson: '{}',
    agentRuntimeCompactJson: '',
    agentDesignHasGeneration: undefined,
    agentLogicalStepsJson: '',
    agentUseCasesJson: '',
    logicalSteps: [],
    useCases: [],
    ...over,
  };
}

describe('resolveHasAgentGeneration', () => {
  it('returns true when agentDesignHasGeneration is true', () => {
    expect(resolveHasAgentGeneration(baseSnapshot({ agentDesignHasGeneration: true }))).toBe(true);
  });

  it('returns false when agentDesignHasGeneration is false', () => {
    expect(resolveHasAgentGeneration(baseSnapshot({ agentDesignHasGeneration: false }))).toBe(false);
  });

  it('legacy: returns true when flag missing but proposed fields exist', () => {
    expect(
      resolveHasAgentGeneration(
        baseSnapshot({
          agentDesignHasGeneration: undefined,
          agentProposedFields: [oneProposed],
        })
      )
    ).toBe(true);
  });

  it('legacy: returns false when flag missing, no proposed fields, long prompt only', () => {
    expect(
      resolveHasAgentGeneration(
        baseSnapshot({
          agentDesignHasGeneration: undefined,
          agentPrompt: 'x'.repeat(100),
        })
      )
    ).toBe(false);
  });
});
