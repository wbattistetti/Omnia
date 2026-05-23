/**
 * Client API: analisi documento KB — propose, refine, review osservazioni, finalize.
 */

import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { parseDesignApiJsonResponse } from '@services/designApiResponse';
import { designAiFetch } from '@services/designAiRequestPipeline';
import type { KbTaskVariableWire } from './kbAgentTaskContext';
import { sanitizeDocumentExcerpt } from './kbDocumentExcerptValidation';
import {
  parseKbAnalysisObservationReview,
  type KbAnalysisObservation,
  type KbAnalysisObservationReview,
} from './kbDocumentAnalysisWorkflow';

export type KbDocumentAnalysisTaskContext = {
  agentTaskSummary: string;
  taskVariables: readonly KbTaskVariableWire[];
  existingUseCaseSummaries: readonly string[];
};

type KbAnalysisApiBase = {
  projectId: string;
  repositoryDocumentId: string;
  documentName: string;
  documentSampleText?: string;
  taskContext?: KbDocumentAnalysisTaskContext;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
  purposeOverride?: string;
};

const TIMEOUT_MS = 120_000;

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

async function postKbAnalysisAction<T>(
  action: string,
  bodyPayload: Record<string, unknown>,
  parse: (body: Record<string, unknown>) => T
): Promise<T> {
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
    return parse(body);
  } finally {
    window.clearTimeout(timer);
  }
}

function parseMarkdownResult(body: Record<string, unknown>): { documentAnalysisMarkdown: string } {
  const text =
    typeof body.documentAnalysisMarkdown === 'string'
      ? body.documentAnalysisMarkdown.trim()
      : '';
  if (!text) throw new Error('Risposta non valida: documentAnalysisMarkdown mancante.');
  return { documentAnalysisMarkdown: text };
}

/** Guardi tu: prima proposta dell'agente dal documento. */
export async function proposeKbDocumentAnalysis(
  params: KbAnalysisApiBase
): Promise<{ documentAnalysisMarkdown: string }> {
  return postKbAnalysisAction(
    'kb_propose_document_analysis',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        documentSampleText: params.documentSampleText ?? '',
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_PROPOSE_DOCUMENT_ANALYSIS'
    ),
    parseMarkdownResult
  );
}

/** Raffina una bozza scritta dall'utente (nessun diff con baseline agente). */
export async function refineKbDocumentAnalysis(
  params: KbAnalysisApiBase & { draftMarkdown: string }
): Promise<{ documentAnalysisMarkdown: string }> {
  return postKbAnalysisAction(
    'kb_refine_document_analysis',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        draftMarkdown: params.draftMarkdown,
        documentSampleText: params.documentSampleText ?? '',
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_REFINE_DOCUMENT_ANALYSIS'
    ),
    parseMarkdownResult
  );
}

/** Confronta baseline agente vs bozza utente; estrae osservazioni. */
export async function reviewKbDocumentAnalysisObservations(
  params: KbAnalysisApiBase & {
    agentBaselineMarkdown: string;
    userDraftMarkdown: string;
  }
): Promise<KbAnalysisObservationReview> {
  return postKbAnalysisAction(
    'kb_review_document_analysis_observations',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        documentSampleText: params.documentSampleText ?? '',
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: params.userDraftMarkdown,
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_REVIEW_DOCUMENT_ANALYSIS_OBSERVATIONS'
    ),
    (body) => parseKbAnalysisObservationReview(body, params.documentSampleText ?? '')
  );
}

/** Riscrive la risposta agente dopo correzione utente su un punto. */
export async function clarifyKbDocumentAnalysisObservation(
  params: KbAnalysisApiBase & {
    userText: string;
    previousInterpretation: string;
    userCorrection: string;
  }
): Promise<{
  interpretation: string;
  documentExcerpt?: string;
  excerptRationale?: string;
}> {
  return postKbAnalysisAction(
    'kb_clarify_document_analysis_observation',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        documentSampleText: params.documentSampleText ?? '',
        userText: params.userText,
        previousInterpretation: params.previousInterpretation,
        userCorrection: params.userCorrection,
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_CLARIFY_DOCUMENT_ANALYSIS_OBSERVATION'
    ),
    (body) => {
      const interpretation =
        typeof body.interpretation === 'string' ? body.interpretation.trim() : '';
      if (!interpretation) {
        throw new Error('Risposta non valida: interpretation mancante.');
      }
      const documentExcerpt = sanitizeDocumentExcerpt(
        body.documentExcerpt,
        params.documentSampleText ?? ''
      );
      const excerptRationale =
        documentExcerpt &&
        typeof body.excerptRationale === 'string' &&
        body.excerptRationale.trim()
          ? body.excerptRationale.trim()
          : undefined;
      return { interpretation, documentExcerpt, excerptRationale };
    }
  );
}

/** Genera analisi finale concordata dopo conferma osservazioni. */
export async function finalizeKbDocumentAnalysis(
  params: KbAnalysisApiBase & {
    agentBaselineMarkdown: string;
    userDraftMarkdown: string;
    observations: readonly KbAnalysisObservation[];
  }
): Promise<{ documentAnalysisMarkdown: string }> {
  return postKbAnalysisAction(
    'kb_finalize_document_analysis',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        documentSampleText: params.documentSampleText ?? '',
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: params.userDraftMarkdown,
        observations: [...params.observations],
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_FINALIZE_DOCUMENT_ANALYSIS'
    ),
    parseMarkdownResult
  );
}
