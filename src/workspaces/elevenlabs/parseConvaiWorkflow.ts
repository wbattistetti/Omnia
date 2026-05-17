/**
 * Maps ElevenLabs `conversation_config.workflow` JSON to Omnia-neutral workflow graph.
 */

import type {
  WorkspaceWorkflowEdge,
  WorkspaceWorkflowGraph,
  WorkspaceWorkflowNode,
  WorkspaceWorkflowNodeKind,
} from '../core/types';
import { parseNodeKnowledgeBase, parseNodeTools } from './parseConvaiNodeKnowledgeAndTools';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function nodeKind(rawType: string): WorkspaceWorkflowNodeKind {
  const t = rawType.trim().toLowerCase();
  if (t === 'start') return 'start';
  if (t === 'end') return 'end';
  if (t === 'override_agent' || t === 'subagent') return 'subagent';
  if (t === 'tool' || t === 'dispatch_tool') return 'tool';
  if (t.includes('transfer')) return 'transfer';
  return 'unknown';
}

function parseEdgeCondition(
  fc: unknown
): Pick<WorkspaceWorkflowEdge, 'conditionKind' | 'conditionText'> {
  const o = asRecord(fc);
  if (!o) return { conditionKind: 'unknown' };
  const type = String(o.type ?? '').trim().toLowerCase();
  if (type === 'unconditional') return { conditionKind: 'unconditional' };
  if (type === 'llm') {
    const cond = typeof o.condition === 'string' ? o.condition.trim() : '';
    return { conditionKind: 'llm', ...(cond ? { conditionText: cond } : {}) };
  }
  if (type === 'expression' || type === 'expr') {
    const expr = typeof o.expression === 'string' ? o.expression.trim() : '';
    return { conditionKind: 'expression', ...(expr ? { conditionText: expr } : {}) };
  }
  return { conditionKind: 'unknown' };
}

function nodeLabel(id: string, raw: Record<string, unknown>): string {
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  if (label) return label;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name) return name;
  return id;
}

function nodePosition(raw: Record<string, unknown>): { x: number; y: number } | undefined {
  const pos = asRecord(raw.position);
  if (!pos) return undefined;
  const x = typeof pos.x === 'number' ? pos.x : Number(pos.x);
  const y = typeof pos.y === 'number' ? pos.y : Number(pos.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}

/** Per-node override text only; must not fall back to agent `conversation_config.agent.prompt`. */
function nodePromptOverride(raw: Record<string, unknown>): string {
  const additional =
    typeof raw.additional_prompt === 'string'
      ? raw.additional_prompt.trim()
      : typeof raw.additionalPrompt === 'string'
        ? raw.additionalPrompt.trim()
        : '';
  if (additional) return additional;
  const goal =
    typeof raw.conversation_goal === 'string'
      ? raw.conversation_goal.trim()
      : typeof raw.conversationGoal === 'string'
        ? raw.conversationGoal.trim()
        : '';
  if (goal) return goal;
  const overridePrompt =
    typeof raw.override_prompt === 'string'
      ? raw.override_prompt.trim()
      : typeof raw.overridePrompt === 'string'
        ? raw.overridePrompt.trim()
        : '';
  if (overridePrompt) return overridePrompt;
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  return prompt;
}

function nodeInheritsGlobalPrompt(kind: WorkspaceWorkflowNodeKind, overrideText: string): boolean {
  return kind === 'subagent' && !overrideText.trim();
}

/**
 * Builds a workflow graph from ConvAI agent payload (`conversation_config` or full agent body).
 */
export function parseConvaiWorkflowFromConversationConfig(
  conversationConfig: unknown,
  /** @deprecated Unused; kept for call-site compatibility. Global prompt is not merged into nodes. */
  _globalPrompt = ''
): WorkspaceWorkflowGraph {
  const cc = asRecord(conversationConfig);
  const wf = cc ? asRecord(cc.workflow) : null;
  if (!wf) {
    return { nodes: [], edges: [] };
  }

  const nodesRaw = asRecord(wf.nodes);
  const edgesRaw = asRecord(wf.edges);
  const nodes: WorkspaceWorkflowNode[] = [];
  const edges: WorkspaceWorkflowEdge[] = [];

  if (nodesRaw) {
    for (const [id, val] of Object.entries(nodesRaw)) {
      const raw = asRecord(val);
      if (!raw) continue;
      const type = String(raw.type ?? 'unknown');
      const edgeOrder = Array.isArray(raw.edge_order)
        ? raw.edge_order.map((x) => String(x))
        : Array.isArray(raw.edgeOrder)
          ? raw.edgeOrder.map((x) => String(x))
          : [];
      const position = nodePosition(raw);
      const kind = nodeKind(type);
      const promptText = nodePromptOverride(raw);
      const inheritsGlobalPrompt = nodeInheritsGlobalPrompt(kind, promptText);
      const isSubagentLike = kind === 'subagent' || kind === 'tool';
      nodes.push({
        id,
        label: nodeLabel(id, raw),
        kind,
        promptText,
        ...(inheritsGlobalPrompt ? { inheritsGlobalPrompt: true } : {}),
        edgeOrder,
        ...(position ? { position } : {}),
        ...(isSubagentLike
          ? {
              knowledgeBase: parseNodeKnowledgeBase(raw),
              tools: parseNodeTools(raw),
              raw: { ...raw },
            }
          : {}),
      });
    }
  }

  if (edgesRaw) {
    for (const [edgeId, val] of Object.entries(edgesRaw)) {
      const raw = asRecord(val);
      if (!raw) continue;
      const source = String(raw.source ?? '').trim();
      const target = String(raw.target ?? '').trim();
      if (!source || !target) continue;
      const label =
        typeof raw.label === 'string' && raw.label.trim()
          ? raw.label.trim()
          : undefined;
      const fc = raw.forward_condition ?? raw.forwardCondition;
      edges.push({
        id: edgeId,
        sourceNodeId: source,
        targetNodeId: target,
        ...(label ? { label } : {}),
        ...parseEdgeCondition(fc),
      });
    }
  }

  return { nodes, edges };
}

export function extractGlobalPromptFromConversationConfig(conversationConfig: unknown): string {
  const cc = asRecord(conversationConfig);
  if (!cc) return '';
  const agent = asRecord(cc.agent);
  if (!agent) return '';
  const promptObj = asRecord(agent.prompt);
  if (!promptObj) return '';
  const p = promptObj.prompt;
  return typeof p === 'string' ? p.trim() : '';
}
