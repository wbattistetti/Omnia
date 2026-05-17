import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildAgentToolInventory } from '../buildAgentToolInventory';
import * as convaiToolApi from '../api/convaiToolApi';
import type { WorkspaceWorkflowGraph } from '../../core/types';

vi.mock('../api/convaiToolApi', () => ({
  resolveConvaiToolIds: vi.fn(),
}));

const workflow: WorkspaceWorkflowGraph = {
  nodes: [
    {
      id: 'n1',
      label: 'Sub A',
      kind: 'subagent',
      promptText: '',
      tools: {
        inheritsAgentTools: true,
        builtInTools: [],
        additionalTools: [{ id: 'node_tool_1', name: 'node_tool_1' }],
      },
    },
  ],
  edges: [],
};

describe('buildAgentToolInventory', () => {
  beforeEach(() => {
    vi.mocked(convaiToolApi.resolveConvaiToolIds).mockReset();
  });

  it('merges inline agent tools and resolves ids', async () => {
    vi.mocked(convaiToolApi.resolveConvaiToolIds)
      .mockResolvedValueOnce([
        {
          id: 'id_from_api',
          name: 'Resolved',
          kind: 'webhook',
          url: 'https://x/h',
          httpMethod: 'GET',
          enabled: true,
          scope: 'agent',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'node_tool_1',
          name: 'Node Hook',
          kind: 'webhook',
          enabled: true,
          scope: 'node',
          nodeId: 'n1',
          nodeLabel: 'Sub A',
        },
      ]);

    const inv = await buildAgentToolInventory(
      {
        agent: {
          prompt: {
            tool_ids: ['id_from_api'],
            tools: [{ type: 'webhook', name: 'inline_dup', api_schema: { url: 'https://y' } }],
          },
        },
      },
      workflow
    );

    expect(inv.agentTools.some((t) => t.id === 'id_from_api')).toBe(true);
    expect(inv.agentTools.some((t) => t.name === 'inline_dup')).toBe(true);
    expect(inv.allTools.some((t) => t.nodeId === 'n1' && t.id === 'node_tool_1')).toBe(true);
    expect(convaiToolApi.resolveConvaiToolIds).toHaveBeenCalledTimes(2);
  });

  it('dedupes same webhook from tool_ids and inline tools by URL', async () => {
    const webhookUrl = 'https://example.test/api/runtime/bookfromagenda';
    vi.mocked(convaiToolApi.resolveConvaiToolIds).mockResolvedValueOnce([
      {
        id: 'tool_convai_uuid_1',
        name: 'bookfromagenda',
        kind: 'webhook',
        url: webhookUrl,
        httpMethod: 'POST',
        enabled: true,
        scope: 'agent',
      },
    ]);

    const inv = await buildAgentToolInventory(
      {
        agent: {
          prompt: {
            tool_ids: ['tool_convai_uuid_1'],
            tools: [
              {
                type: 'webhook',
                name: 'bookfromagenda',
                api_schema: { url: webhookUrl, method: 'POST' },
              },
            ],
          },
        },
      },
      { nodes: [], edges: [] }
    );

    expect(inv.agentTools).toHaveLength(1);
    expect(inv.agentTools[0]?.name).toBe('bookfromagenda');
    expect(inv.agentTools[0]?.id).toBe('tool_convai_uuid_1');
  });
});
