/**
 * Tests for unified handle → anchor → screen helpers (Intellisense edge anchor).
 */

import { describe, expect, it } from 'vitest';
import type { Connection } from 'reactflow';
import { internalsSymbol } from 'reactflow';
import {
  anchorFlowForOrthEdgeLinkUI,
  computeLinkMidScreenFromConnectionUnified,
  readHandleCentersFlowFromStore,
} from '../edgeIntellisenseAnchorFromHandles';
import type { ReactFlowStoreLike } from '../waitForHandleBounds';

function makeStoreWithNodes(
  source: { id: string; abs: { x: number; y: number }; sourceHandles: Array<{ id: string; x: number; y: number; width: number; height: number }> },
  target: { id: string; abs: { x: number; y: number }; targetHandles: Array<{ id: string; x: number; y: number; width: number; height: number }> },
): ReactFlowStoreLike {
  const mkInternal = (abs: { x: number; y: number }, handleBounds: { source?: typeof source.sourceHandles; target?: typeof target.targetHandles }) => ({
    [internalsSymbol as any]: {
      positionAbsolute: abs,
      handleBounds,
    },
    positionAbsolute: abs,
  });

  const nodeInternals = new Map<string, unknown>([
    [source.id, mkInternal(source.abs, { source: source.sourceHandles })],
    [target.id, mkInternal(target.abs, { target: target.targetHandles })],
  ]);

  return {
    getState: () => ({ nodeInternals }),
  } as ReactFlowStoreLike;
}

describe('readHandleCentersFlowFromStore', () => {
  it('returns centers for matched handle ids', () => {
    const store = makeStoreWithNodes(
      {
        id: 'a',
        abs: { x: 10, y: 20 },
        sourceHandles: [{ id: 'right', x: 100, y: 40, width: 8, height: 8 }],
      },
      {
        id: 'b',
        abs: { x: 300, y: 50 },
        targetHandles: [{ id: 'left-target', x: 0, y: 30, width: 8, height: 8 }],
      },
    );

    const c = readHandleCentersFlowFromStore({
      storeApi: store,
      sourceNodeId: 'a',
      targetNodeId: 'b',
      sourceHandleId: 'right',
      targetHandleId: 'left-target',
    });
    expect(c).not.toBeNull();
    expect(c!.sx).toBeCloseTo(10 + 100 + 4);
    expect(c!.sy).toBeCloseTo(20 + 40 + 4);
    expect(c!.tx).toBeCloseTo(300 + 0 + 4);
    expect(c!.ty).toBeCloseTo(50 + 30 + 4);
  });

  it('returns null when a node is missing', () => {
    const store = makeStoreWithNodes(
      { id: 'a', abs: { x: 0, y: 0 }, sourceHandles: [{ id: 'r', x: 1, y: 1, width: 2, height: 2 }] },
      { id: 'b', abs: { x: 0, y: 0 }, targetHandles: [{ id: 't', x: 1, y: 1, width: 2, height: 2 }] },
    );
    expect(
      readHandleCentersFlowFromStore({
        storeApi: store,
        sourceNodeId: 'missing',
        targetNodeId: 'b',
        sourceHandleId: 'r',
        targetHandleId: 't',
      }),
    ).toBeNull();
  });
});

describe('anchorFlowForOrthEdgeLinkUI', () => {
  it('delegates to orth port hint from handle ids', () => {
    const centers = { sx: 0, sy: 0, tx: 100, ty: 200 };
    const a = anchorFlowForOrthEdgeLinkUI(centers, 'bottom-source', 'top-target');
    expect(a).toHaveProperty('x');
    expect(a).toHaveProperty('y');
    expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
  });
});

describe('computeLinkMidScreenFromConnectionUnified', () => {
  it('maps anchor to screen via flowToScreenPosition', () => {
    const store = makeStoreWithNodes(
      {
        id: 's',
        abs: { x: 0, y: 0 },
        sourceHandles: [{ id: 'right', x: 50, y: 0, width: 10, height: 10 }],
      },
      {
        id: 't',
        abs: { x: 200, y: 0 },
        targetHandles: [{ id: 'left-target', x: 0, y: 0, width: 10, height: 10 }],
      },
    );

    const conn: Connection = {
      source: 's',
      target: 't',
      sourceHandle: 'right',
      targetHandle: 'left-target',
    };

    const screen = computeLinkMidScreenFromConnectionUnified(store, { flowToScreenPosition: (p) => ({ x: p.x * 2, y: p.y * 2 }) }, conn, {
      x: -1,
      y: -1,
    });

    expect(screen.x).not.toBe(-1);
    expect(screen.y).not.toBe(-1);
  });

  it('uses fallback when source or target missing', () => {
    const store = makeStoreWithNodes(
      { id: 's', abs: { x: 0, y: 0 }, sourceHandles: [{ id: 'r', x: 1, y: 1, width: 2, height: 2 }] },
      { id: 't', abs: { x: 0, y: 0 }, targetHandles: [{ id: 't', x: 1, y: 1, width: 2, height: 2 }] },
    );
    const fb = { x: 42, y: 43 };
    expect(
      computeLinkMidScreenFromConnectionUnified(
        store,
        { flowToScreenPosition: (p) => p },
        { source: null, target: 't', sourceHandle: 'r', targetHandle: 't' },
        fb,
      ),
    ).toEqual(fb);
  });
});
