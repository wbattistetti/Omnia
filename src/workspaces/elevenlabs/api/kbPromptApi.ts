/**
 * Client for ElevenLabs KB Markdown snippet generation (/design/ai-agent-generate).
 */

import type { KbExtractedVariable } from '../parseKbDocument';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { emitDesignAiLlmBurstFromErrorResponse } from '@utils/aiAgentHighFrequencyAlert';
import { confirmAiAgentGenerateIfEnabled } from '@utils/aiAgentGenerateConfirmGate';
import { designAiFetch } from '@services/designAiRequestPipeline';
import { parseKbMarkdownHttpBody } from './readKbMarkdownHttpResponse';

const DEFAULT_TIMEOUT_MS = 120_000;

export type KbLocalSnippetInput = {
  documentName: string;
  nodeLabel?: string;
  markdownSnippet: string;
  variables?: readonly KbExtractedVariable[];
};

function applyCallMeta(body: Record<string, unknown>, callMeta?: AiCallMeta): void {
  if (!callMeta) return;
  if (callMeta.purpose?.trim()) body.purpose = callMeta.purpose.trim();
  if (callMeta.taskId?.trim()) body.taskId = callMeta.taskId.trim();
  if (callMeta.taskLabel?.trim()) body.taskLabel = callMeta.taskLabel.trim();
}

async function postKbAction(body: Record<string, unknown>): Promise<string> {
  await confirmAiAgentGenerateIfEnabled();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await designAiFetch('/design/ai-agent-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/markdown, application/json;q=0.8',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await res.text();
    const contentType = res.headers.get('content-type') ?? '';
    const parsed = parseKbMarkdownHttpBody(raw, contentType, res.ok);
    if (!res.ok || parsed.success === false) {
      emitDesignAiLlmBurstFromErrorResponse(res, parsed);
      throw new Error(parsed.error?.trim() || `HTTP ${res.status}`);
    }
    const markdown = typeof parsed.markdown === 'string' ? parsed.markdown.trim() : '';
    if (!markdown) {
      throw new Error('Risposta IA senza Markdown');
    }
    return markdown;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeKbDocumentSnippet(params: {
  documentName: string;
  howToUse: string;
  variables: readonly KbExtractedVariable[];
  existingMarkdown?: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}): Promise<string> {
  const body: Record<string, unknown> = {
    action: 'kb_snippet',
    documentName: params.documentName,
    howToUse: params.howToUse,
    variables: params.variables,
    existingMarkdown: params.existingMarkdown ?? '',
    provider: params.provider.toLowerCase(),
    model: params.model,
    outputLanguage: params.outputLanguage,
  };
  applyCallMeta(body, params.callMeta);
  return postKbAction(body);
}

export async function refineKbSystemPrompt(params: {
  existingPromptMarkdown: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}): Promise<string> {
  const body: Record<string, unknown> = {
    action: 'kb_refine_prompt',
    existingPromptMarkdown: params.existingPromptMarkdown,
    provider: params.provider.toLowerCase(),
    model: params.model,
    outputLanguage: params.outputLanguage,
  };
  applyCallMeta(body, params.callMeta);
  return postKbAction(body);
}

export async function aggregateKbSystemPrompt(params: {
  localSnippets: readonly KbLocalSnippetInput[];
  existingPromptMarkdown?: string;
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
}): Promise<string> {
  const body: Record<string, unknown> = {
    action: 'kb_aggregate_prompt',
    localSnippets: params.localSnippets.map((s) => ({
      documentName: s.documentName,
      nodeLabel: s.nodeLabel,
      markdownSnippet: s.markdownSnippet,
      variables: s.variables ?? [],
    })),
    existingPromptMarkdown: params.existingPromptMarkdown ?? '',
    provider: params.provider.toLowerCase(),
    model: params.model,
    outputLanguage: params.outputLanguage,
  };
  applyCallMeta(body, params.callMeta);
  return postKbAction(body);
}
