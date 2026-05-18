import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearPositionCommitDedupe } from '../flowPositionCommitDedupe';
import { registerFlowCanvasStoreSemanticHandler } from '../flowCanvasSemanticRegistry';
import {
  FLOW_CANVAS_SEMANTIC_EVENT,
  emitNodePositionCommitted,
  subscribeFlowCanvasSemantic,
} from '../flowCanvasSemanticEvents';

beforeEach(() => {
  clearPositionCommitDedupe();
});

describe('flowCanvasSemanticEvents', () => {
  it('emitNodePositionCommitted dispatches NODE_POSITION_COMMITTED', () => {
    const handler = vi.fn();
    const unsub = subscribeFlowCanvasSemantic(handler);

    emitNodePositionCommitted('main', [
      { nodeId: 'a', position: { x: 10, y: 20 } },
    ]);

    expect(handler).toHaveBeenCalledWith({
      type: 'NODE_POSITION_COMMITTED',
      flowId: 'main',
      updates: [{ nodeId: 'a', position: { x: 10, y: 20 } }],
    });

    unsub();
  });

  it('skips empty position updates', () => {
    const handler = vi.fn();
    const listener = (e: Event) => handler((e as CustomEvent).detail);
    window.addEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);

    emitNodePositionCommitted('main', []);
    expect(handler).not.toHaveBeenCalled();

    window.removeEventListener(FLOW_CANVAS_SEMANTIC_EVENT, listener);
  });

  it('delivers position commit to the store handler once per emit', () => {
    const storeHandler = vi.fn();
    const cleanup = registerFlowCanvasStoreSemanticHandler('main', storeHandler);
    const updates = [{ nodeId: 'a', position: { x: 5, y: 6 } }];

    emitNodePositionCommitted('main', updates);

    expect(storeHandler).toHaveBeenCalledTimes(1);
    expect(storeHandler).toHaveBeenCalledWith({
      type: 'NODE_POSITION_COMMITTED',
      flowId: 'main',
      updates,
    });
    cleanup();
  });

  it('dedupes identical position commits at emit time', () => {
    const handler = vi.fn();
    const unsub = subscribeFlowCanvasSemantic(handler);
    const updates = [{ nodeId: 'a', position: { x: 1, y: 2 } }];

    emitNodePositionCommitted('main', updates);
    emitNodePositionCommitted('main', updates);

    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });
});
