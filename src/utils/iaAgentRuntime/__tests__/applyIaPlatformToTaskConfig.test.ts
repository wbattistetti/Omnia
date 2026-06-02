import { describe, expect, it } from 'vitest';
import { getDefaultConfig } from '../platformHelpers';
import { applyIaPlatformToTaskConfig } from '../applyIaPlatformToTaskConfig';

describe('applyIaPlatformToTaskConfig', () => {
  it('sets elevenlabs platform and preserves convaiAgentId', () => {
    const openai = getDefaultConfig('openai');
    const next = applyIaPlatformToTaskConfig(
      { ...openai, convaiAgentId: 'agent_abc' },
      'elevenlabs'
    );
    expect(next.platform).toBe('elevenlabs');
    expect(next.convaiAgentId).toBe('agent_abc');
    expect(next.model).toBe('convai_default');
  });
});
