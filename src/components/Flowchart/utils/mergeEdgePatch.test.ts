import { describe, it, expect } from 'vitest';
import type { Edge } from 'reactflow';
import type { EdgeData } from '../types/flowTypes';
import { mergeEdgePatch } from './mergeEdgePatch';
import {
  resolveEdgeCaption,
  edgeHasConditionBinding,
  edgeCaptionRequiresMutedStyle,
  buildClearEdgeConditionUpdates,
} from './edgeConditionState';

const baseEdge = (): Edge<EdgeData> =>
  ({
    id: 'e1',
    source: 'a',
    target: 'b',
    label: 'Old',
    data: {
      label: 'Old',
      onDeleteEdge: () => {},
      hasConditionScript: false,
    },
  }) as Edge<EdgeData>;

describe('mergeEdgePatch', () => {
  it('dual-writes label to top-level and data', () => {
    const e = baseEdge();
    const next = mergeEdgePatch(e, { label: 'New' });
    expect(next.label).toBe('New');
    expect((next.data as any).label).toBe('New');
    expect((next.data as any).onDeleteEdge).toBeDefined();
  });

  it('prefers data.label when resolving display after partial legacy state', () => {
    const caption = resolveEdgeCaption({
      label: 'Stale',
      data: { label: 'Canonical' },
    });
    expect(caption).toBe('Canonical');
  });

  it('clears label in both places', () => {
    const e = baseEdge();
    const next = mergeEdgePatch(e, { label: undefined });
    expect(next.label).toBeUndefined();
    expect((next.data as any).label).toBeUndefined();
  });

  it('sets and clears conditionId on top-level and data', () => {
    const e = baseEdge();
    const withC = mergeEdgePatch(e, { conditionId: 'c-1' });
    expect((withC as any).conditionId).toBe('c-1');
    expect((withC.data as any).conditionId).toBe('c-1');
    const cleared = mergeEdgePatch(withC, { conditionId: undefined });
    expect((cleared as any).conditionId).toBeUndefined();
    expect((cleared.data as any).conditionId).toBeUndefined();
  });

  it('merges nested updates.data without dropping callbacks', () => {
    const e = baseEdge();
    const next = mergeEdgePatch(e, { data: { hasConditionScript: true } });
    expect((next.data as any).hasConditionScript).toBe(true);
    expect((next.data as any).onDeleteEdge).toBeDefined();
  });
});

describe('edgeConditionState', () => {
  it('detects binding for else and conditionId', () => {
    expect(edgeHasConditionBinding({ isElse: true })).toBe(true);
    expect(edgeHasConditionBinding({ conditionId: 'x' })).toBe(true);
    expect(edgeHasConditionBinding({ data: { hasConditionScript: true } })).toBe(true);
    expect(edgeHasConditionBinding({ label: 'Only text', data: {} })).toBe(false);
  });

  it('muted only when caption without binding', () => {
    expect(edgeCaptionRequiresMutedStyle({ label: 'Hi', data: {} })).toBe(true);
    expect(edgeCaptionRequiresMutedStyle({ label: 'Hi', conditionId: 'c' })).toBe(false);
    expect(edgeCaptionRequiresMutedStyle({ data: {} })).toBe(false);
  });

  it('buildClearEdgeConditionUpdates includes clears', () => {
    const u = buildClearEdgeConditionUpdates();
    expect(u.label).toBeUndefined();
    expect(u.conditionId).toBeUndefined();
    expect(u.isElse).toBe(false);
    expect(u.data.actType).toBeUndefined();
  });
});
