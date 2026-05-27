/**
 * Client API: backend usage analysis — propose, refine, review, clarify, finalize.
 */

import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { parseDesignApiJsonResponse } from '@services/designApiResponse';
import { designAiFetch } from '@services/designAiRequestPipeline';
import type { KbDocumentAnalysisTaskContext } from '@domain/knowledgeBase/kbDocumentAnalysisApi';
import {
  excerptDuplicatesDesignerNote,
  sanitizeDocumentExcerpt,
} from '@domain/knowledgeBase/kbDocumentExcerptValidation';
import {
  parseKbAnalysisObservationReview,
  type KbAnalysisObservation,
  type KbAnalysisObservationReview,
} from './backendAnalysisWorkflow';

type BackendAnalysisApiBase = {
  projectId: string;
  agentTaskId: string;
  referenceCorpus: string;
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

async function postBackendAnalysisAction<T>(
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

function parseMarkdownResult(body: Record<string, unknown>): { backendAnalysisMarkdown: string } {
  const text =
    typeof body.backendAnalysisMarkdown === 'string'
      ? body.backendAnalysisMarkdown.trim()
      : '';
  if (!text) throw new Error('Risposta non valida: backendAnalysisMarkdown mancante.');
  return { backendAnalysisMarkdown: text };
}

export async function proposeBackendAnalysis(
  params: BackendAnalysisApiBase
): Promise<{ backendAnalysisMarkdown: string }> {
  return postBackendAnalysisAction(
    'backend_propose_analysis',
    applyCallMeta(
      {
        projectId: params.projectId,
        agentTaskId: params.agentTaskId,
        referenceCorpus: params.referenceCorpus,
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'BACKEND_PROPOSE_ANALYSIS'
    ),
    parseMarkdownResult
  );
}

export async function refineBackendAnalysis(
  params: BackendAnalysisApiBase & { draftMarkdown: string }
): Promise<{ backendAnalysisMarkdown: string }> {
  return postBackendAnalysisAction(
    'backend_refine_analysis',
    applyCallMeta(
      {
        projectId: params.projectId,
        agentTaskId: params.agentTaskId,
        referenceCorpus: params.referenceCorpus,
        draftMarkdown: params.draftMarkdown,
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'BACKEND_REFINE_ANALYSIS'
    ),
    parseMarkdownResult
  );
}

export async function reviewBackendAnalysisObservations(
  params: BackendAnalysisApiBase & {
    agentBaselineMarkdown: string;
    userDraftMarkdown: string;
  }
): Promise<KbAnalysisObservationReview> {
  return postBackendAnalysisAction(
    'backend_review_analysis_observations',
    applyCallMeta(
      {
        projectId: params.projectId,
        agentTaskId: params.agentTaskId,
        referenceCorpus: params.referenceCorpus,
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: params.userDraftMarkdown,
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'BACKEND_REVIEW_ANALYSIS_OBSERVATIONS'
    ),
    (body) => parseKbAnalysisObservationReview(body, params.referenceCorpus)
  );
}

export async function clarifyBackendAnalysisObservation(
  params: BackendAnalysisApiBase & {
    userText: string;
    previousInterpretation: string;
    userCorrection: string;
  }
): Promise<{
  interpretation: string;
  documentExcerpt?: string;
  excerptRationale?: string;
}> {
  return postBackendAnalysisAction(
    'backend_clarify_analysis_observation',
    applyCallMeta(
      {
        projectId: params.projectId,
        agentTaskId: params.agentTaskId,
        referenceCorpus: params.referenceCorpus,
        userText: params.userText,
        previousInterpretation: params.previousInterpretation,
        userCorrection: params.userCorrection,
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'BACKEND_CLARIFY_ANALYSIS_OBSERVATION'
    ),
    (body) => {
      const interpretation =
        typeof body.interpretation === 'string' ? body.interpretation.trim() : '';
      if (!interpretation) {
        throw new Error('Risposta non valida: interpretation mancante.');
      }
      let documentExcerpt = sanitizeDocumentExcerpt(
        body.documentExcerpt,
        params.referenceCorpus
      );
      if (
        documentExcerpt &&
        excerptDuplicatesDesignerNote(documentExcerpt, params.userText)
      ) {
        documentExcerpt = undefined;
      }
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

export async function finalizeBackendAnalysis(
  params: BackendAnalysisApiBase & {
    agentBaselineMarkdown: string;
    userDraftMarkdown: string;
    observations: readonly KbAnalysisObservation[];
  }
): Promise<{ backendAnalysisMarkdown: string }> {
  return postBackendAnalysisAction(
    'backend_finalize_analysis',
    applyCallMeta(
      {
        projectId: params.projectId,
        agentTaskId: params.agentTaskId,
        referenceCorpus: params.referenceCorpus,
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: params.userDraftMarkdown,
        observations: [...params.observations],
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'BACKEND_FINALIZE_ANALYSIS'
    ),
    parseMarkdownResult
  );
}
