import { describe, expect, it } from 'vitest';
import {
  graphHasRemoteLayout,
  mergeWorkflowPositionOverrides,
} from '../workflowLayoutPositions';
import { buildReactFlowFromWorkspaceGraph } from '../convaiWorkflowToReactFlow';
import { inferNodeHandlePositions } from '../inferWorkflowNodeHandles';

describe('workflowLayoutPositions', () => {
  it('graphHasRemoteLayout is true when any node has position', () => {
    expect(
      graphHasRemoteLayout({
        nodes: [{ id: 'a', label: 'A', kind: 'start', promptText: '', edgeOrder: [], position: { x: 1, y: 2 } }],
        edges: [],
      })
    ).toBe(true);
  });

  it('mergeWorkflowPositionOverrides prefers overrides', () => {
    const g = mergeWorkflowPositionOverrides(
      {
        nodes: [
          {
            id: 'a',
            label: 'A',
            kind: 'start',
            promptText: '',
            edgeOrder: [],
            position: { x: 10, y: 20 },
          },
        ],
        edges: [],
      },
      { a: { x: 99, y: 88 } }
    );
    expect(g.nodes[0]?.position).toEqual({ x: 99, y: 88 });
  });
});

describe('buildReactFlowFromWorkspaceGraph layout', () => {
  it('uses API positions and bezier edges', () => {
    const { nodes, edges } = buildReactFlowFromWorkspaceGraph({
      nodes: [
        { id: 's', label: 'Start', kind: 'start', promptText: '', edgeOrder: [], position: { x: 0, y: 0 } },
        {
          id: 'b',
          label: 'B',
          kind: 'subagent',
          promptText: '',
          edgeOrder: [],
          position: { x: 400, y: 0 },
        },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 's', targetNodeId: 'b', conditionKind: 'unconditional' },
      ],
    });
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(nodes[1]?.position).toEqual({ x: 400, y: 0 });
    expect(edges[0]?.type).toBe('default');
    expect(edges[0]?.style?.stroke).toBe('#c4a574');
  });

  it('infers vertical handles when targets are below', () => {
    const positions = new Map([
      ['a', { x: 0, y: 0 }],
      ['b', { x: 0, y: 200 }],
    ]);
    const h = inferNodeHandlePositions('a', positions, [
      { id: 'e', sourceNodeId: 'a', targetNodeId: 'b', conditionKind: 'unconditional' },
    ]);
    expect(h.sourcePosition).toBe('bottom');
  });
});
