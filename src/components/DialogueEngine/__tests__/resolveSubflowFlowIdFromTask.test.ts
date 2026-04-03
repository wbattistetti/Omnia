/**
 * Subflow flowId resolution for VB compile payload (root flowId required by ApiServer).
 */
import { describe, it, expect } from 'vitest';
import { resolveSubflowFlowIdFromTask, resolveSubflowFlowIdExplicitOnly } from '../backendCompileFlowGraph';

describe('resolveSubflowFlowIdFromTask', () => {
  it('returns root flowId when set', () => {
    expect(resolveSubflowFlowIdFromTask({ id: 't1', flowId: 'subflow_t1', type: 3 })).toBe('subflow_t1');
  });

  it('reads flowId from parameters when root is missing', () => {
    expect(
      resolveSubflowFlowIdFromTask({
        id: 't1',
        type: 3,
        parameters: [{ parameterId: 'flowId', value: 'subflow_t1' }],
      })
    ).toBe('subflow_t1');
  });

  it('falls back to subflow_<id> when no flowId stored', () => {
    expect(resolveSubflowFlowIdFromTask({ id: 'bd809bb2-fd56-4a6b-bbb7-1e17a484e494-mvgaxk9b0', type: 3 })).toBe(
      'subflow_bd809bb2-fd56-4a6b-bbb7-1e17a484e494-mvgaxk9b0'
    );
  });

  it('returns empty for null/empty task', () => {
    expect(resolveSubflowFlowIdFromTask(null)).toBe('');
    expect(resolveSubflowFlowIdFromTask({})).toBe('');
  });
});

describe('resolveSubflowFlowIdExplicitOnly', () => {
  it('returns root or parameters only — no subflow_<id> fallback', () => {
    expect(resolveSubflowFlowIdExplicitOnly({ id: 't1', type: 3 })).toBe('');
    expect(
      resolveSubflowFlowIdExplicitOnly({
        id: 't1',
        type: 3,
        parameters: [{ parameterId: 'flowId', value: 'subflow_real' }],
      })
    ).toBe('subflow_real');
    expect(resolveSubflowFlowIdExplicitOnly({ id: 't1', flowId: 'subflow_x', type: 3 })).toBe('subflow_x');
  });
});
