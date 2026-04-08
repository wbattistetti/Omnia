import { describe, expect, it, vi } from 'vitest';
import { resolveEffectiveDropTargetNodeId } from '../resolveEffectiveDropTargetNodeId';

vi.mock('../subflowRowDragCanvasPolicy', () => ({
  resolveFlowCanvasIdUnderPointer: vi.fn(),
}));

import { resolveFlowCanvasIdUnderPointer } from '../subflowRowDragCanvasPolicy';

const mockPointer = vi.mocked(resolveFlowCanvasIdUnderPointer);

describe('resolveEffectiveDropTargetNodeId', () => {
  it('returns direct hit when it targets another node', () => {
    mockPointer.mockReturnValue('subflow_ab');
    const flows = { subflow_ab: { nodes: [{ id: 'n2' }] } } as any;
    expect(
      resolveEffectiveDropTargetNodeId({
        dropFromElementAtRelease: 'n2',
        sourceNodeId: 'n1',
        hoverTargetNodeId: null,
        sourceFlowCanvasId: 'main',
        ptrX: 1,
        ptrY: 2,
        flows,
      })
    ).toBe('n2');
  });

  it('falls back to last hover when pane hit but hover node is on pointer subflow', () => {
    mockPointer.mockReturnValue('subflow_sf');
    const flows = { subflow_sf: { nodes: [{ id: 'nSub' }] } } as any;
    expect(
      resolveEffectiveDropTargetNodeId({
        dropFromElementAtRelease: null,
        sourceNodeId: 'nMain',
        hoverTargetNodeId: 'nSub',
        sourceFlowCanvasId: 'main',
        ptrX: 1,
        ptrY: 2,
        flows,
      })
    ).toBe('nSub');
  });

  it('falls back to sole node on subflow slice when pane hit and no hover', () => {
    mockPointer.mockReturnValue('subflow_sf');
    const flows = { subflow_sf: { nodes: [{ id: 'only' }] } } as any;
    expect(
      resolveEffectiveDropTargetNodeId({
        dropFromElementAtRelease: null,
        sourceNodeId: 'nMain',
        hoverTargetNodeId: null,
        sourceFlowCanvasId: 'main',
        ptrX: 1,
        ptrY: 2,
        flows,
      })
    ).toBe('only');
  });
});
