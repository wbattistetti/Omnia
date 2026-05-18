/**
 * Client for KB semantic analysis via /design/ai-agent-generate.
 */

import type { KbExtractedVariable } from '@workspaces/elevenlabs/parseKbDocument';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { KbChatMessage, KbDocumentStructure, KbInducedRule } from '@domain/knowledgeBase/kbRuleTypes';
import { normalizeKbRules } from '@domain/knowledgeBase/kbRuleTypes';
import { confirmAiAgentGenerateIfEnabled } from '@utils/aiAgentGenerateConfirmGate';
import { designAiFetch } from '@services/designAiRequestPipeline';
import { readFetchJson } from '@utils/readFetchJson';

export type KbSemanticAnalysisResult = {
  structure: KbDocumentStructure;
  dataTypes: string[];
  rules: KbInducedRule[];
  /** Short Italian opener for chat after first Analyze. */
  chatOpener?: string;
  analysisNote?: string;
  truncated?: boolean;
  totalChars?: number;
};

export type KbChatResult = {
  reply: string;
  rulePatch: KbSemanticAnalysisResult | null;
  truncated?: boolean;
  totalChars?: number;
};

function applyCallMeta(body: Record<string, unknown>, callMeta?: AiCallMeta): void {
  if (!callMeta) return;
  if (callMeta.purpose?.trim()) body.purpose = callMeta.purpose.trim();
  if (callMeta.taskId?.trim()) body.taskId = callMeta.taskId.trim();
  if (callMeta.taskLabel?.trim()) body.taskLabel = callMeta.taskLabel.trim();
}

async function postKbJsonAction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await confirmAiAgentGenerateIfEnabled();
  const res = await designAiFetch('/design/ai-agent-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await readFetchJson<Record<string, unknown>>(res);
  if (!res.ok || raw.success === false) {
    throw new Error(String(raw.error ?? `HTTP ${res.status}`));
  }
  return raw;
}

function mapDataTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => String(t).trim()).filter(Boolean);
}

function mapAnalysisResult(raw: Record<string, unknown>): KbSemanticAnalysisResult {
  return {
    structure:
      raw.structure && typeof raw.structure === 'object'
        ? (raw.structure as KbDocumentStructure)
        : {},
    dataTypes: mapDataTypes(raw.dataTypes),
    rules: normalizeKbRules(raw.rules),
    chatOpener: typeof raw.chatOpener === 'string' ? raw.chatOpener : undefined,
    analysisNote: typeof raw.analysisNote === 'string' ? raw.analysisNote : undefined,
    truncated: raw.truncated === true,
    totalChars: typeof raw.totalChars === 'number' ? raw.totalChars : undefined,
  };
}

export async function analyzeKbSemantic(params: {
  projectId: string;
  repositoryDocumentId: string;
  documentName: string;
  variables: readonly KbExtractedVariable[];
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}): Promise<KbSemanticAnalysisResult> {
  const body: Record<string, unknown> = {
    action: 'kb_analyze_semantic',
    projectId: params.projectId,
    repositoryDocumentId: params.repositoryDocumentId,
    documentName: params.documentName,
    variables: params.variables,
    provider: params.provider.toLowerCase(),
    model: params.model,
  };
  applyCallMeta(body, params.callMeta);
  return mapAnalysisResult(await postKbJsonAction(body));
}

export async function reanalyzeKbRules(params: {
  projectId: string;
  repositoryDocumentId: string;
  documentName: string;
  variables: readonly KbExtractedVariable[];
  structureJson: string;
  dataTypes: readonly string[];
  rules: readonly KbInducedRule[];
  analysisIntent: string;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}): Promise<KbSemanticAnalysisResult> {
  const body: Record<string, unknown> = {
    action: 'kb_reanalyze_rules',
    projectId: params.projectId,
    repositoryDocumentId: params.repositoryDocumentId,
    documentName: params.documentName,
    variables: params.variables,
    structureJson: params.structureJson,
    dataTypes: params.dataTypes,
    rules: params.rules.filter((r) => !r.deleted),
    analysisIntent: params.analysisIntent,
    provider: params.provider.toLowerCase(),
    model: params.model,
  };
  applyCallMeta(body, params.callMeta);
  return mapAnalysisResult(await postKbJsonAction(body));
}

export async function startKbChat(params: {
  projectId: string;
  repositoryDocumentId: string;
  documentName: string;
  variables: readonly KbExtractedVariable[];
  structureJson: string;
  dataTypes: readonly string[];
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}): Promise<KbChatResult> {
  const body: Record<string, unknown> = {
    action: 'kb_chat_start',
    projectId: params.projectId,
    repositoryDocumentId: params.repositoryDocumentId,
    documentName: params.documentName,
    variables: params.variables,
    structureJson: params.structureJson,
    dataTypes: params.dataTypes,
    provider: params.provider.toLowerCase(),
    model: params.model,
  };
  applyCallMeta(body, params.callMeta);
  const raw = await postKbJsonAction(body);
  return {
    reply: String(raw.reply ?? ''),
    rulePatch: raw.rulePatch ? mapAnalysisResult(raw.rulePatch as Record<string, unknown>) : null,
    truncated: raw.truncated === true,
    totalChars: typeof raw.totalChars === 'number' ? raw.totalChars : undefined,
  };
}

export async function chatKbDocument(params: {
  projectId: string;
  repositoryDocumentId: string;
  documentName: string;
  variables: readonly KbExtractedVariable[];
  structureJson: string;
  dataTypes: readonly string[];
  rules: readonly KbInducedRule[];
  messages: readonly KbChatMessage[];
  userMessage: string;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}): Promise<KbChatResult> {
  const body: Record<string, unknown> = {
    action: 'kb_chat',
    projectId: params.projectId,
    repositoryDocumentId: params.repositoryDocumentId,
    documentName: params.documentName,
    variables: params.variables,
    structureJson: params.structureJson,
    dataTypes: params.dataTypes,
    rules: params.rules.filter((r) => !r.deleted),
    messages: params.messages,
    userMessage: params.userMessage,
    provider: params.provider.toLowerCase(),
    model: params.model,
  };
  applyCallMeta(body, params.callMeta);
  const raw = await postKbJsonAction(body);
  return {
    reply: String(raw.reply ?? ''),
    rulePatch: raw.rulePatch ? mapAnalysisResult(raw.rulePatch as Record<string, unknown>) : null,
    truncated: raw.truncated === true,
    totalChars: typeof raw.totalChars === 'number' ? raw.totalChars : undefined,
  };
}

/** Merge chat rule patch into existing rules (by id). */
export function mergeKbRules(
  existing: readonly KbInducedRule[],
  incoming: readonly KbInducedRule[]
): KbInducedRule[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const r of incoming) {
    byId.set(r.id, r);
  }
  return [...byId.values()];
}
