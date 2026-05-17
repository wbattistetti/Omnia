/**
 * Parses per-workflow-node Knowledge Base and Tools from ConvAI override_agent payloads.
 */

import { convaiSystemToolLabelIt } from './convaiSystemToolLabels';
import type {
  WorkspaceNodeBuiltInTool,
  WorkspaceNodeKnowledgeBase,
  WorkspaceNodeTools,
} from '../core/types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function readBool(obj: Record<string, unknown> | null, ...keys: string[]): boolean | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    if (!(key in obj)) continue;
    const v = obj[key];
    if (typeof v === 'boolean') return v;
  }
  return undefined;
}

function nestedAgentConfig(raw: Record<string, unknown>): Record<string, unknown> | null {
  const cc = asRecord(raw.conversation_config) ?? asRecord(raw.conversationConfig);
  return asRecord(cc?.agent);
}

function nestedPrompt(agent: Record<string, unknown> | null): Record<string, unknown> | null {
  return asRecord(agent?.prompt);
}

function parseKnowledgeDocuments(rawList: unknown): WorkspaceNodeKnowledgeBase['additionalDocuments'] {
  if (!Array.isArray(rawList)) return [];
  const out: WorkspaceNodeKnowledgeBase['additionalDocuments'] = [];
  for (const item of rawList) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ id: item.trim(), name: item.trim() });
      continue;
    }
    const o = asRecord(item);
    if (!o) continue;
    const id =
      typeof o.id === 'string'
        ? o.id.trim()
        : typeof o.document_id === 'string'
          ? o.document_id.trim()
          : typeof o.documentId === 'string'
            ? o.documentId.trim()
            : '';
    if (!id) continue;
    const name =
      typeof o.name === 'string'
        ? o.name.trim()
        : typeof o.title === 'string'
          ? o.title.trim()
          : id;
    out.push({ id, name });
  }
  return out;
}

function parseInheritKnowledge(raw: Record<string, unknown>): boolean {
  const direct = readBool(
    raw,
    'use_agent_knowledge_base',
    'useAgentKnowledgeBase',
    'include_agent_knowledge_base',
    'includeAgentKnowledgeBase',
    'inherit_knowledge_base',
    'inheritKnowledgeBase'
  );
  if (direct !== undefined) return direct;

  const kb = asRecord(raw.knowledge_base) ?? asRecord(raw.knowledgeBase);
  const nested = readBool(
    kb,
    'use_agent_knowledge_base',
    'useAgentKnowledgeBase',
    'include_global_knowledge_base',
    'includeGlobalKnowledgeBase'
  );
  if (nested !== undefined) return nested;

  const agent = nestedAgentConfig(raw);
  const agentKb = asRecord(agent?.knowledge_base) ?? asRecord(agent?.knowledgeBase);
  const fromAgent = readBool(
    agentKb,
    'use_agent_knowledge_base',
    'useAgentKnowledgeBase',
    'include_global_knowledge_base'
  );
  if (fromAgent !== undefined) return fromAgent;

  return true;
}

function parseInheritTools(raw: Record<string, unknown>): boolean {
  const direct = readBool(
    raw,
    'use_agent_tools',
    'useAgentTools',
    'include_agent_tools',
    'includeAgentTools',
    'inherit_tools',
    'inheritTools'
  );
  if (direct !== undefined) return direct;

  const toolsBlock = asRecord(raw.tools);
  const nested = readBool(toolsBlock, 'use_agent_tools', 'useAgentTools', 'include_global_tools');
  if (nested !== undefined) return nested;

  return true;
}

function parseBuiltInTools(raw: Record<string, unknown>): WorkspaceNodeBuiltInTool[] {
  const agent = nestedAgentConfig(raw);
  const prompt = nestedPrompt(agent);
  const toolsRaw = prompt?.tools;
  if (!Array.isArray(toolsRaw)) return [];

  const out: WorkspaceNodeBuiltInTool[] = [];
  for (const item of toolsRaw) {
    const o = asRecord(item);
    if (!o) continue;
    const type = String(o.type ?? '').trim().toLowerCase();
    if (type && type !== 'system') continue;
    const name =
      typeof o.name === 'string'
        ? o.name.trim()
        : typeof o.tool_name === 'string'
          ? o.tool_name.trim()
          : '';
    if (!name) continue;
    const disabled = o.disabled === true || o.enabled === false;
    out.push({
      id: name,
      label: convaiSystemToolLabelIt(name),
      enabled: !disabled,
    });
  }
  return out;
}

function parseAdditionalToolIds(raw: Record<string, unknown>): WorkspaceNodeTools['additionalTools'] {
  const idsRaw =
    raw.additional_tool_ids ??
    raw.additionalToolIds ??
    raw.tool_ids ??
    raw.toolIds;
  if (!Array.isArray(idsRaw)) return [];
  return idsRaw
    .map((x) => String(x).trim())
    .filter(Boolean)
    .map((id) => ({ id, name: id }));
}

/** Knowledge base slice for a workflow node (read-only mirror). */
export function parseNodeKnowledgeBase(raw: Record<string, unknown>): WorkspaceNodeKnowledgeBase {
  const additionalRaw =
    raw.additional_knowledge_base ??
    raw.additionalKnowledgeBase ??
    raw.knowledge_base_documents ??
    raw.knowledgeBaseDocuments;
  return {
    inheritsAgentKnowledgeBase: parseInheritKnowledge(raw),
    additionalDocuments: parseKnowledgeDocuments(additionalRaw),
  };
}

/** Tools slice for a workflow node (read-only mirror). */
export function parseNodeTools(raw: Record<string, unknown>): WorkspaceNodeTools {
  return {
    inheritsAgentTools: parseInheritTools(raw),
    builtInTools: parseBuiltInTools(raw),
    additionalTools: parseAdditionalToolIds(raw),
  };
}
