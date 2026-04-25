/**
 * Tests for merging ConvAI agent id from global defaults when task override has none.
 */

import { describe, expect, it } from 'vitest';
import {
  mergeConvaiAgentIdFromGlobalDefaults,
  parseOptionalIaRuntimeJson,
} from '../iaAgentConfigNormalize';
import { getDefaultConfig } from '../platformHelpers';

describe('mergeConvaiAgentIdFromGlobalDefaults', () => {
  it('non copia convaiAgentId dai globali (id ConvAI solo in sessione tab)', () => {
    const task = { ...getDefaultConfig('elevenlabs'), convaiAgentId: undefined };
    const globals = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_global_1' };
    const out = mergeConvaiAgentIdFromGlobalDefaults(task, globals);
    expect(out.convaiAgentId).toBeUndefined();
  });

  it('does not override non-empty task convaiAgentId', () => {
    const task = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'task_only' };
    const globals = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_global_1' };
    const out = mergeConvaiAgentIdFromGlobalDefaults(task, globals);
    expect(out.convaiAgentId).toBe('task_only');
  });

  it('no-op for non-ElevenLabs platform', () => {
    const task = { ...getDefaultConfig('openai') };
    const globals = { ...getDefaultConfig('elevenlabs'), convaiAgentId: 'agent_global_1' };
    const out = mergeConvaiAgentIdFromGlobalDefaults(task, globals);
    expect(out).toEqual(task);
  });
});

describe('parseOptionalIaRuntimeJson', () => {
  it('returns null for empty or invalid JSON', () => {
    expect(parseOptionalIaRuntimeJson(undefined)).toBeNull();
    expect(parseOptionalIaRuntimeJson('')).toBeNull();
    expect(parseOptionalIaRuntimeJson('{')).toBeNull();
  });

  it('parses valid JSON object', () => {
    expect(parseOptionalIaRuntimeJson('{"platform":"elevenlabs"}')).toEqual({
      platform: 'elevenlabs',
    });
  });
});
