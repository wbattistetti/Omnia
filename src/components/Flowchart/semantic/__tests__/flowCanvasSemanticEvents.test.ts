import { describe, it, expect, vi } from 'vitest';
import {
  FLOW_CANVAS_SEMANTIC_EVENT,
  emitNodePositionCommitted,
  subscribeFlowCanvasSemantic,
} from '../flowCanvasSemanticEvents';

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
});
