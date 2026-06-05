import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENT_CONVAI_DEPLOY_MODE,
  isKbDeterministicDeployMode,
  normalizeAgentConvaiDeployMode,
} from '../agentConvaiDeployMode';

describe('agentConvaiDeployMode', () => {
  it('defaults to legacy', () => {
    expect(normalizeAgentConvaiDeployMode(undefined)).toBe('legacy');
    expect(normalizeAgentConvaiDeployMode('invalid')).toBe(DEFAULT_AGENT_CONVAI_DEPLOY_MODE);
  });

  it('accepts kb_deterministic', () => {
    expect(normalizeAgentConvaiDeployMode('kb_deterministic')).toBe('kb_deterministic');
    expect(isKbDeterministicDeployMode('kb_deterministic')).toBe(true);
    expect(isKbDeterministicDeployMode('legacy')).toBe(false);
  });
});
