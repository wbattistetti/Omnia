import { describe, expect, it } from 'vitest';
import { parseConvaiWorkflowFromConversationConfig } from '../parseConvaiWorkflow';

/**
 * Mirrors pickConversationConfig merge in convaiAgentApi (workflow at GET agent root).
 */
function mergeAgentPayload(data: Record<string, unknown>): Record<string, unknown> {
  const ccRaw = data.conversation_config ?? data.conversationConfig;
  const cc =
    ccRaw && typeof ccRaw === 'object' && !Array.isArray(ccRaw)
      ? ({ ...(ccRaw as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  const topWorkflow = data.workflow;
  if (topWorkflow && typeof topWorkflow === 'object' && !Array.isArray(topWorkflow)) {
    cc.workflow = topWorkflow;
  }
  return cc;
}

describe('GET agent workflow at root', () => {
  it('parse sees nodes after merging root workflow into conversation_config', () => {
    const payload = {
      conversation_config: { agent: { prompt: { prompt: 'Global' } } },
      workflow: {
        nodes: {
          start_node: { type: 'start', edge_order: ['e1'] },
          sub_a: { type: 'subagent', label: 'New subagent', edge_order: [] },
        },
        edges: {
          e1: {
            source: 'start_node',
            target: 'sub_a',
            forward_condition: { type: 'unconditional' },
          },
        },
      },
    };
    const cc = mergeAgentPayload(payload);
    const g = parseConvaiWorkflowFromConversationConfig(cc, 'Global');
    expect(g.nodes.length).toBe(2);
    expect(g.edges.length).toBe(1);
    expect(g.nodes.find((n) => n.id === 'sub_a')?.label).toBe('New subagent');
  });
});
