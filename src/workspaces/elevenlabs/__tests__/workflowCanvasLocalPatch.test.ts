import { describe, expect, it } from 'vitest';
import {
  applyWorkflowCanvasLocalPatch,
  duplicateWorkflowNode,
  truncateAgentLabel,
} from '../workflowCanvasLocalPatch';
import type { WorkspaceWorkflowGraph } from '../../core/types';

const baseGraph: WorkspaceWorkflowGraph = {
  nodes: [
    {
      id: 'a',
      label: 'Start',
      kind: 'start',
      promptText: '',
      edgeOrder: [],
      position: { x: 0, y: 0 },
    },
    {
      id: 'b',
      label: 'Agent one',
      kind: 'subagent',
      promptText: 'Do work',
      edgeOrder: [],
      position: { x: 100, y: 80 },
    },
  ],
  edges: [{ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b', conditionKind: 'unconditional' }],
};

describe('workflowCanvasLocalPatch', () => {
  it('truncates long titles to five words', () => {
    expect(truncateAgentLabel('uno due tre quattro cinque sei')).toBe('uno due tre quattro cinque…');
    expect(truncateAgentLabel('breve')).toBe('breve');
  });

  it('duplicates node with offset and new id', () => {
    const src = baseGraph.nodes[1]!;
    const copy = duplicateWorkflowNode(src, { x: 100, y: 80 });
    expect(copy.id).not.toBe(src.id);
    expect(copy.position).toEqual({ x: 156, y: 136 });
    expect(copy.label).toContain('(copia)');
  });

  it('applies added and removed nodes', () => {
    const copy = duplicateWorkflowNode(baseGraph.nodes[1]!, { x: 0, y: 0 });
    const merged = applyWorkflowCanvasLocalPatch(baseGraph, {
      addedNodes: [copy],
      removedNodeIds: ['b'],
    });
    expect(merged.nodes.map((n) => n.id)).toEqual(['a', copy.id]);
  });
});
