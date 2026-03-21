import { describe, it, expect, vi } from 'vitest';
import { internalsSymbol } from 'reactflow';
import { waitForHandleBounds, type ReactFlowStoreLike } from '../waitForHandleBounds';

function makeInternalWithTarget() {
  return {
    [internalsSymbol]: {
      handleBounds: {
        target: [{ id: 'top-target', x: 0, y: 0, width: 8, height: 8 }],
      },
    },
  };
}

describe('waitForHandleBounds', () => {
  it('resolves immediately if target handles already exist', async () => {
    const nodeId = 'temp-1';
    const internal = makeInternalWithTarget();
    const map = new Map([[nodeId, internal]]);
    const store: ReactFlowStoreLike = {
      getState: () => ({ nodeInternals: map }),
      subscribe: () => () => {},
    };
    await expect(waitForHandleBounds(store, nodeId, 500)).resolves.toBe(internal);
  });

  it('resolves when store notifies after handles are set', async () => {
    const nodeId = 'temp-2';
    const map = new Map<string, unknown>();
    let notify: (() => void) | null = null;
    const store: ReactFlowStoreLike = {
      getState: () => ({ nodeInternals: map }),
      subscribe: (listener) => {
        notify = listener;
        return vi.fn();
      },
    };
    const p = waitForHandleBounds(store, nodeId, 500);
    map.set(nodeId, makeInternalWithTarget());
    notify!();
    await expect(p).resolves.toBeDefined();
  });

  it('rejects on timeout if handles never appear', async () => {
    const store: ReactFlowStoreLike = {
      getState: () => ({ nodeInternals: new Map() }),
      subscribe: () => () => {},
    };
    await expect(waitForHandleBounds(store, 'missing', 50)).rejects.toThrow(/timeout/);
  });
});
