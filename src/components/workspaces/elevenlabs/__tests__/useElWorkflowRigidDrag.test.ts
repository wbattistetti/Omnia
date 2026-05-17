import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Edge, Node } from 'reactflow';
import { useElWorkflowRigidDrag, EL_RIGID_ANCHOR_CLASS } from '../useElWorkflowRigidDrag';

describe('useElWorkflowRigidDrag', () => {
  it('translates descendants when drag starts from rigid anchor', () => {
    const edges: Edge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];
    const initial: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 0, y: 100 }, data: {} },
      { id: 'c', position: { x: 0, y: 200 }, data: {} },
    ];
    let nodes = initial;
    const setNodes = (updater: React.SetStateAction<Node[]>) => {
      nodes = typeof updater === 'function' ? updater(nodes) : updater;
    };

    const { result } = renderHook(() => useElWorkflowRigidDrag(edges, setNodes));
    const anchor = document.createElement('button');
    anchor.className = EL_RIGID_ANCHOR_CLASS;

    act(() => {
      result.current.onNodeDragStart(
        { target: anchor } as unknown as React.MouseEvent,
        { id: 'a', position: { x: 10, y: 0 }, data: {} } as Node
      );
    });

    act(() => {
      result.current.onNodeDrag(
        {} as React.MouseEvent,
        { id: 'a', position: { x: 20, y: 0 }, data: {} } as Node
      );
    });

    expect(nodes.find((n) => n.id === 'b')?.position).toEqual({ x: 10, y: 100 });
    expect(nodes.find((n) => n.id === 'c')?.position).toEqual({ x: 10, y: 200 });
  });
});
