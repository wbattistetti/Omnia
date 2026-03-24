import { describe, it, expect } from 'vitest';
import { shouldLoadFlowFromServer, isRealProjectId } from '../flowHydrationPolicy';
import type { Flow } from '../FlowTypes';

const emptyFlow = (over: Partial<Flow> = {}): Flow => ({
  id: 'main',
  title: 'Main',
  nodes: [],
  edges: [],
  ...over,
});

describe('flowHydrationPolicy', () => {
  it('isRealProjectId rejects empty', () => {
    expect(isRealProjectId(undefined)).toBe(false);
    expect(isRealProjectId('')).toBe(false);
    expect(isRealProjectId('   ')).toBe(false);
  });

  it('isRealProjectId accepts non-empty id', () => {
    expect(isRealProjectId('p1')).toBe(true);
  });

  it('shouldLoadFlowFromServer is false without project', () => {
    expect(shouldLoadFlowFromServer(undefined, emptyFlow())).toBe(false);
  });

  it('shouldLoadFlowFromServer is false without flow', () => {
    expect(shouldLoadFlowFromServer('p1', undefined)).toBe(false);
  });

  it('shouldLoadFlowFromServer allows empty local graph when not hydrated and no edits', () => {
    expect(shouldLoadFlowFromServer('p1', emptyFlow({ hydrated: false, hasLocalChanges: false }))).toBe(true);
  });

  it('shouldLoadFlowFromServer blocks when hydrated', () => {
    expect(shouldLoadFlowFromServer('p1', emptyFlow({ hydrated: true, hasLocalChanges: false }))).toBe(false);
  });

  it('shouldLoadFlowFromServer blocks when hasLocalChanges', () => {
    expect(shouldLoadFlowFromServer('p1', emptyFlow({ hydrated: false, hasLocalChanges: true }))).toBe(false);
  });

  it('shouldLoadFlowFromServer blocks when local graph is non-empty', () => {
    expect(
      shouldLoadFlowFromServer(
        'p1',
        emptyFlow({ hydrated: false, hasLocalChanges: false, nodes: [{ id: 'n1' } as any] })
      )
    ).toBe(false);
  });
});
