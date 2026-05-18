import { describe, expect, it } from 'vitest';
import {
  mergeNodesWithDragOverlay,
  overlayMatchesStorePositions,
  pinOverlayToPositions,
} from '../ephemeralNodeDrag';

describe('ephemeralNodeDrag', () => {
  it('overlayMatchesStorePositions returns true when store matches pinned coords', () => {
    const overlay = pinOverlayToPositions([
      { nodeId: 'a', position: { x: 10, y: 20 } },
    ]);
    const nodes = [{ id: 'a', position: { x: 10, y: 20 } }];
    expect(overlayMatchesStorePositions(nodes, overlay)).toBe(true);
  });

  it('overlayMatchesStorePositions returns false when store is stale', () => {
    const overlay = pinOverlayToPositions([
      { nodeId: 'a', position: { x: 100, y: 200 } },
    ]);
    const nodes = [{ id: 'a', position: { x: 10, y: 20 } }];
    expect(overlayMatchesStorePositions(nodes, overlay)).toBe(false);
  });

  it('mergeNodesWithDragOverlay applies overlay without clearing store ids', () => {
    const nodes = [{ id: 'a', position: { x: 0, y: 0 }, data: {} }];
    const overlay = pinOverlayToPositions([
      { nodeId: 'a', position: { x: 50, y: 60 } },
    ]);
    const merged = mergeNodesWithDragOverlay(nodes as any, overlay);
    expect(merged[0].position).toEqual({ x: 50, y: 60 });
  });
});
