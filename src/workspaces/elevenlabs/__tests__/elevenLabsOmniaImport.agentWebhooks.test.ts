import { describe, expect, it } from 'vitest';
import {
  collectAgentWebhookTools,
  collectWebhookToolsForNode,
} from '../elevenLabsOmniaImport';
import type { WorkspaceAgentToolInventory, WorkspaceWorkflowNode } from '../../core/types';

describe('collectAgentWebhookTools', () => {
  it('returns all agent-level webhook tools', () => {
    const inventory: WorkspaceAgentToolInventory = {
      agentTools: [
        { id: 'w1', name: 'Hook A', kind: 'webhook', scope: 'agent', url: 'https://a.test/h' },
        { id: 'l1', name: 'LLM', kind: 'llm', scope: 'agent' },
      ],
      allTools: [],
    };
    expect(collectAgentWebhookTools(inventory).map((t) => t.id)).toEqual(['w1']);
  });

  it('node scope is narrower than agent when node does not inherit', () => {
    const node: WorkspaceWorkflowNode = {
      id: 'n1',
      label: 'Sub',
      kind: 'subagent',
      tools: { inheritsAgentTools: false, toolIds: [] },
    };
    const inventory: WorkspaceAgentToolInventory = {
      agentTools: [
        { id: 'w1', name: 'Hook A', kind: 'webhook', scope: 'agent', url: 'https://a.test/h' },
      ],
      allTools: [],
    };
    expect(collectWebhookToolsForNode(node, inventory)).toHaveLength(0);
    expect(collectAgentWebhookTools(inventory)).toHaveLength(1);
  });
});
