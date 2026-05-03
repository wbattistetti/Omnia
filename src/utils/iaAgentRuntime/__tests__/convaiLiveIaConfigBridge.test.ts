import { describe, expect, it } from 'vitest';
import {
  mergeResolvedAndLiveIaConfig,
  peekConvaiLiveIaConfig,
  registerConvaiLiveIaConfig,
  unregisterConvaiLiveIaConfig,
} from '../convaiLiveIaConfigBridge';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

describe('convaiLiveIaConfigBridge', () => {
  it('mergeResolvedAndLiveIaConfig: live overrides shallow fields', () => {
    const resolved = {
      platform: 'elevenlabs',
      convaiBackendToolTaskIds: ['a'],
    } as IAAgentConfig;
    const live = { convaiBackendToolTaskIds: ['a', 'b'] } as IAAgentConfig;
    const m = mergeResolvedAndLiveIaConfig(resolved, live);
    expect(m.platform).toBe('elevenlabs');
    expect(m.convaiBackendToolTaskIds).toEqual(['a', 'b']);
  });

  it('mergeResolvedAndLiveIaConfig: without live returns resolved', () => {
    const resolved = { platform: 'elevenlabs' } as IAAgentConfig;
    expect(mergeResolvedAndLiveIaConfig(resolved, undefined)).toBe(resolved);
    expect(mergeResolvedAndLiveIaConfig(resolved, null)).toBe(resolved);
  });

  it('register / unregister / peek by taskId', () => {
    const tid = 'task-guid-1';
    unregisterConvaiLiveIaConfig(tid);
    expect(peekConvaiLiveIaConfig(tid)).toBeUndefined();
    registerConvaiLiveIaConfig(tid, { platform: 'elevenlabs' } as IAAgentConfig);
    expect(peekConvaiLiveIaConfig(tid)?.platform).toBe('elevenlabs');
    unregisterConvaiLiveIaConfig(tid);
    expect(peekConvaiLiveIaConfig(tid)).toBeUndefined();
  });
});
