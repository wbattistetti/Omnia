/**
 * Tests for runtime experiment JSON payload wrapper.
 */

import { describe, expect, it } from 'vitest';
import {
  AI_AGENT_IMMEDIATE_START_SYNTHETIC_USER_MESSAGE,
  buildAiAgentRuntimeExperimentPayload,
  stringifyExperimentPayload,
} from '../aiAgentRuntimeExperimentJson';

describe('aiAgentRuntimeExperimentJson', () => {
  it('stringifyExperimentPayload is valid JSON', () => {
    const p = buildAiAgentRuntimeExperimentPayload('rules', { task: 't' }, []);
    const s = stringifyExperimentPayload(p);
    const o = JSON.parse(s) as { compileInput: { rules: string } };
    expect(o.compileInput.rules).toBe('rules');
  });

  it('immediate start mirrors orchestrator contract', () => {
    const p = buildAiAgentRuntimeExperimentPayload('rules', {}, [], { immediateStart: true });
    expect(p.compileInput.first_message).toBe('');
    expect(p.compileInput.immediateStart).toBe(true);
    expect(p.runtimeStepPayload.user_message).toBe(AI_AGENT_IMMEDIATE_START_SYNTHETIC_USER_MESSAGE);
  });
});
