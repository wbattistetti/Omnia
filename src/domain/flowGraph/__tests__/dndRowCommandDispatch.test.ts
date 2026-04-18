import { describe, expect, it } from 'vitest';
import { buildCrossNodeRowMoveDetail, inferDndRowCommandKind } from '../dndRowCommandDispatch';
import type { DragRowPayload } from '../dndRowPayloadTypes';

describe('buildCrossNodeRowMoveDetail', () => {
  it('includes rowId and _state.handled=false', () => {
    const d = buildCrossNodeRowMoveDetail({
      fromNodeId: 'a',
      toNodeId: 'b',
      draggedRowId: 'row1',
      rowData: { id: 'row1', text: 'x' },
      draggedRowIndex: 0,
      mousePosition: { x: 1, y: 2 },
      fromFlowCanvasId: 'main',
      toFlowCanvasId: 'main',
      targetRowId: null,
      targetRegion: 'node',
      targetRowInsertIndex: 1,
    });
    expect(d.rowId).toBe('row1');
    expect((d._state as { handled: boolean }).handled).toBe(false);
    expect(d.targetRowInsertIndex).toBe(1);
  });
});

describe('inferDndRowCommandKind', () => {
  it('returns MoveRowToSubflow for portal region', () => {
    const p = {
      operation: 'move' as const,
      rowId: 'r',
      rowData: { id: 'r', text: '' },
      sourceFlowId: 'main',
      sourceNodeId: 'n1',
      sourceIndex: 0,
      targetFlowId: 'main',
      targetNodeId: 'n2',
      targetRowId: 'portal',
      targetRegion: 'portal',
    } satisfies DragRowPayload;
    expect(inferDndRowCommandKind(p)).toBe('MoveRowToSubflow');
  });

  it('returns MoveRowToNode for distinct nodes same flow', () => {
    const p = {
      operation: 'move',
      rowId: 'r',
      rowData: { id: 'r', text: '' },
      sourceFlowId: 'main',
      sourceNodeId: 'n1',
      sourceIndex: 0,
      targetFlowId: 'main',
      targetNodeId: 'n2',
      targetRowId: null,
      targetRegion: 'row',
    } as DragRowPayload;
    expect(inferDndRowCommandKind(p)).toBe('MoveRowToNode');
  });
});
