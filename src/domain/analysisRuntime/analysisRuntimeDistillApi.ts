/**
 * Client API: distillazione estrema analisi KB/backend per contesto runtime LLM.
 */

import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { parseDesignApiJsonResponse } from '@services/designApiResponse';
import { designAiFetch } from '@services/designAiRequestPipeline';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';

const TIMEOUT_MS = 90_000;

type DistillApiBase = {
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
  purposeOverride?: string;
  taskContext?: KbDocumentAnalysisTaskContext;
};

function applyCallMeta(
  bodyPayload: Record<string, unknown>,
  callMeta: AiCallMeta | undefined,
  purposeOverride?: string
): Record<string, unknown> {
  if (callMeta?.taskId?.trim()) bodyPayload.taskId = callMeta.taskId.trim();
  if (callMeta?.taskLabel?.trim()) bodyPayload.taskLabel = callMeta.taskLabel.trim();
  if (purposeOverride?.trim()) bodyPayload.purpose = purposeOverride.trim();
  else if (callMeta?.purpose?.trim()) bodyPayload.purpose = callMeta.purpose.trim();
  return bodyPayload;
}

function taskContextFields(taskContext?: KbDocumentAnalysisTaskContext): Record<string, unknown> {
  return {
    agentTaskSummary: taskContext?.agentTaskSummary ?? '',
    taskVariables: taskContext?.taskVariables ?? [],
    existingUseCaseSummaries: taskContext?.existingUseCaseSummaries ?? [],
  };
}

function parseRuntimeDistill(body: Record<string, unknown>): { runtimeDistilledMarkdown: string } {
  const text =
    typeof body.runtimeDistilledMarkdown === 'string'
      ? body.runtimeDistilledMarkdown.trim()
      : '';
  if (!text) throw new Error('Risposta non valida: runtimeDistilledMarkdown mancante.');
  return { runtimeDistilledMarkdown: text };
}

async function postRuntimeDistill(
  action: string,
  bodyPayload: Record<string, unknown>
): Promise<{ runtimeDistilledMarkdown: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await designAiFetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...bodyPayload }),
      signal: controller.signal,
    });
    const body = (await parseDesignApiJsonResponse(res)) as Record<string, unknown> & {
      success?: boolean;
      error?: string;
    };
    if (!res.ok || !body?.success) {
      throw new Error(typeof body?.error === 'string' ? body.error.trim() : `HTTP ${res.status}`);
    }
    return parseRuntimeDistill(body);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Distillazione estrema LLM di un'analisi documento KB (input già ridotto euristicamente). */
export async function distillKbDocumentAnalysisRuntime(
  params: DistillApiBase & { documentName: string; analysisMarkdown: string }
): Promise<{ runtimeDistilledMarkdown: string }> {
  return postRuntimeDistill(
    'kb_distill_document_analysis_runtime',
    applyCallMeta(
      {
        documentName: params.documentName,
        analysisMarkdown: params.analysisMarkdown,
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_DISTILL_DOCUMENT_ANALYSIS_RUNTIME'
    )
  );
}

/** Distillazione estrema LLM dell'analisi backend per generazione use case. */
export async function distillBackendAnalysisRuntime(
  params: DistillApiBase & { agentTaskId: string; analysisMarkdown: string }
): Promise<{ runtimeDistilledMarkdown: string }> {
  return postRuntimeDistill(
    'backend_distill_analysis_runtime',
    applyCallMeta(
      {
        agentTaskId: params.agentTaskId,
        analysisMarkdown: params.analysisMarkdown,
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'BACKEND_DISTILL_ANALYSIS_RUNTIME'
    )
  );
}
