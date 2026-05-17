/**
 * Builds agent + workflow-scoped tool inventory for ElevenLabs workspace UI.
 */

import type {
  WorkspaceAgentToolInventory,
  WorkspaceResolvedTool,
  WorkspaceWorkflowGraph,
} from '../core/types';
import { resolveConvaiToolIds } from './api/convaiToolApi';
import { extractPromptToolIdsAndInline, parseConvaiInlineTool } from './parseConvaiInlineTools';

/** Dedupe key: ConvAI often lists the same webhook in `tool_ids` and inline `tools[]` with different ids. */
export function agentToolDedupeKey(t: WorkspaceResolvedTool): string {
  const url = t.url?.trim().toLowerCase();
  if (url) {
    const method = (t.httpMethod ?? 'POST').trim().toUpperCase() || 'POST';
    return `url:${method}:${url}`;
  }
  const name = (t.name || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  const id = (t.id || '').trim();
  return id ? `id:${id}` : '';
}

function toolMergeScore(t: WorkspaceResolvedTool): number {
  let score = 0;
  if (t.url?.trim()) score += 2;
  if (t.id.trim() && t.id.trim() !== (t.name || '').trim()) score += 2;
  if (t.httpMethod?.trim()) score += 1;
  return score;
}

function mergeAgentTools(
  inline: WorkspaceResolvedTool[],
  resolved: WorkspaceResolvedTool[]
): WorkspaceResolvedTool[] {
  const byKey = new Map<string, WorkspaceResolvedTool>();
  for (const t of [...resolved, ...inline]) {
    const key = agentToolDedupeKey(t);
    if (!key) continue;
    const prev = byKey.get(key);
    const next = { ...t, scope: 'agent' as const };
    if (!prev || toolMergeScore(next) > toolMergeScore(prev)) {
      byKey.set(key, next);
    }
  }
  return [...byKey.values()];
}

/**
 * Loads full tool inventory for a ConvAI agent snapshot (network: list/GET tools).
 */
export async function buildAgentToolInventory(
  conversationConfig: unknown,
  workflow: WorkspaceWorkflowGraph
): Promise<WorkspaceAgentToolInventory> {
  const { toolIds, inline } = extractPromptToolIdsAndInline(conversationConfig);
  const resolvedAgent = toolIds.length > 0 ? await resolveConvaiToolIds(toolIds, 'agent') : [];
  const agentTools = mergeAgentTools(inline, resolvedAgent);

  const agentIdSet = new Set(agentTools.map((t) => t.id));
  const allTools: WorkspaceResolvedTool[] = [...agentTools];

  for (const node of workflow.nodes) {
    if (node.kind !== 'subagent' && node.kind !== 'tool') continue;
    const additionalIds = node.tools?.additionalTools.map((t) => t.id) ?? [];
    if (additionalIds.length === 0) continue;
    const nodeMeta = { nodeId: node.id, nodeLabel: node.label };
    const resolvedNode = await resolveConvaiToolIds(additionalIds, 'node', nodeMeta);
    for (const t of resolvedNode) {
      if (!agentIdSet.has(t.id)) {
        allTools.push(t);
      } else {
        allTools.push({ ...t, scope: 'node', nodeId: node.id, nodeLabel: node.label });
      }
    }
  }

  return { agentTools, allTools };
}

export function emptyToolInventory(): WorkspaceAgentToolInventory {
  return { agentTools: [], allTools: [] };
}
