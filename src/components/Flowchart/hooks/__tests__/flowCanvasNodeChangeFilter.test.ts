import { describe, expect, it } from 'vitest';
import type { Node, NodeChange } from 'reactflow';
import {
  applyWorkspaceNodeChangesPreservingPositions,
  filterWorkspaceNodeChanges,
  isNonDragPositionChange,
} from '../flowCanvasNodeChangeFilter';

describe('flowCanvasNodeChangeFilter', () => {
  it('detects non-drag position changes', () => {
    expect(isNonDragPositionChange({ type: 'position', id: 'a', dragging: false })).toBe(true);
    expect(isNonDragPositionChange({ type: 'position', id: 'a', dragging: true })).toBe(false);
    expect(isNonDragPositionChange({ type: 'select', id: 'a', selected: true })).toBe(false);
  });

  it('drops position and dimensions changes; passes select through', () => {
    const changes: NodeChange[] = [
      { type: 'position', id: 'n1', position: { x: 1, y: 2 }, dragging: false },
      { type: 'dimensions', id: 'n1', dimensions: { width: 100, height: 50 } },
      { type: 'select', id: 'n1', selected: true },
    ];
    const workspace = filterWorkspaceNodeChanges(changes);
    expect(workspace).toHaveLength(1);
    expect(workspace[0].type).toBe('select');
  });

  it('preserves store positions when RF dimensions change would revert layout', () => {
    const prev: Node[] = [
      {
        id: 'n1',
        type: 'default',
        position: { x: 100, y: 200 },
        data: {},
        width: 80,
        height: 40,
      },
    ];
    const changes: NodeChange[] = [
      {
        type: 'dimensions',
        id: 'n1',
        dimensions: { width: 120, height: 60 },
        // RF often carries stale position inside the merged node
        position: { x: 0, y: 0 },
      } as NodeChange,
    ];
    const next = applyWorkspaceNodeChangesPreservingPositions(prev, changes);
    expect(next[0].position).toEqual({ x: 100, y: 200 });
    expect(next[0].width).toBe(120);
    expect(next[0].height).toBe(60);
  });
});
