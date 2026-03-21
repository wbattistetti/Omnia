import { describe, it, expect } from 'vitest';
import { internalsSymbol } from 'reactflow';
import { getSourceHandleCenterInFlow } from '../sourceHandleCenterInFlow';

describe('getSourceHandleCenterInFlow', () => {
  it('returns center from handleBounds.source and positionAbsolute', () => {
    const nodeId = 'n1';
    const internal = {
      positionAbsolute: { x: 10, y: 20 },
      [internalsSymbol]: {
        positionAbsolute: { x: 10, y: 20 },
        handleBounds: {
          source: [{ id: 'bottom', x: 100, y: 80, width: 16, height: 16 }],
        },
      },
    };
    const store = {
      getState: () => ({
        nodeInternals: new Map([[nodeId, internal]]),
      }),
      subscribe: () => () => {},
    };

    const c = getSourceHandleCenterInFlow(store, nodeId, 'bottom');
    expect(c).toEqual({ x: 10 + 100 + 8, y: 20 + 80 + 8 });
  });

  it('falls back to first source handle when id not found', () => {
    const nodeId = 'n1';
    const internal = {
      positionAbsolute: { x: 0, y: 0 },
      [internalsSymbol]: {
        positionAbsolute: { x: 0, y: 0 },
        handleBounds: {
          source: [{ id: 'other', x: 5, y: 5, width: 10, height: 10 }],
        },
      },
    };
    const store = {
      getState: () => ({
        nodeInternals: new Map([[nodeId, internal]]),
      }),
      subscribe: () => () => {},
    };

    const c = getSourceHandleCenterInFlow(store, nodeId, 'bottom');
    expect(c).toEqual({ x: 10, y: 10 });
  });

  it('returns null when node missing', () => {
    const store = {
      getState: () => ({ nodeInternals: new Map() }),
      subscribe: () => () => {},
    };
    expect(getSourceHandleCenterInFlow(store, 'x', 'bottom')).toBeNull();
  });
});
