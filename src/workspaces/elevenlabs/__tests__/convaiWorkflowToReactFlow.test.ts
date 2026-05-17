import { describe, expect, it } from 'vitest';
import { buildReactFlowFromWorkspaceGraph } from '../convaiWorkflowToReactFlow';

describe('buildReactFlowFromWorkspaceGraph', () => {
  it('shows SYSTEM PROMPT on canvas when node inherits global', () => {
    const { nodes } = buildReactFlowFromWorkspaceGraph({
      nodes: [
        {
          id: 'v',
          label: 'Chiedi visita',
          kind: 'subagent',
          promptText: '',
          inheritsGlobalPrompt: true,
          edgeOrder: [],
        },
      ],
      edges: [],
    });
    expect(nodes[0]?.data.promptPreview).toBe('SYSTEM PROMPT');
    expect(nodes[0]?.data.inheritsGlobalPrompt).toBe(true);
  });

  it('labels unconditional edges as sempre', () => {
    const { edges } = buildReactFlowFromWorkspaceGraph({
      nodes: [
        { id: 'a', label: 'A', kind: 'start', promptText: '', edgeOrder: [] },
        { id: 'b', label: 'B', kind: 'subagent', promptText: '', edgeOrder: [] },
      ],
      edges: [
        {
          id: 'e1',
          sourceNodeId: 'a',
          targetNodeId: 'b',
          conditionKind: 'unconditional',
        },
      ],
    });
    expect(edges[0]?.label).toBe('sempre');
  });
});
