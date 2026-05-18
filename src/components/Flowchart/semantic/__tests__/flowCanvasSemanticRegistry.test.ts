import { describe, expect, it, vi } from 'vitest';
import {
  clearFlowCanvasStoreSemanticHandlers,
  dispatchFlowCanvasStoreSemantic,
  registerFlowCanvasStoreSemanticHandler,
} from '../flowCanvasSemanticRegistry';

describe('flowCanvasSemanticRegistry', () => {
  it('delivers events only to the registered handler for that flowId', () => {
    const main = vi.fn();
    const other = vi.fn();
    const unMain = registerFlowCanvasStoreSemanticHandler('main', main);
    const unSub = registerFlowCanvasStoreSemanticHandler('subflow_x', other);

    dispatchFlowCanvasStoreSemantic({
      type: 'NODE_POSITION_COMMITTED',
      flowId: 'main',
      updates: [{ nodeId: 'a', position: { x: 1, y: 2 } }],
    });

    expect(main).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();

    unMain();
    unSub();
    clearFlowCanvasStoreSemanticHandlers();
  });

  it('replaces handler when a new bridge registers for the same flowId', () => {
    const first = vi.fn();
    const second = vi.fn();
    const un1 = registerFlowCanvasStoreSemanticHandler('main', first);
    const un2 = registerFlowCanvasStoreSemanticHandler('main', second);

    dispatchFlowCanvasStoreSemantic({
      type: 'NODE_LAYOUT_SETTLED',
      flowId: 'main',
      nodeId: 'n1',
      width: 10,
      height: 10,
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);

    un1();
    un2();
    clearFlowCanvasStoreSemanticHandlers();
  });
});
