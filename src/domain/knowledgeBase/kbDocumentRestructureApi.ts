/**
 * Client API: riformattazione documento KB — propose e refine.
 */

import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { parseDesignApiJsonResponse } from '@services/designApiResponse';
import { designAiFetch } from '@services/designAiRequestPipeline';
import type { KbTaskVariableWire } from './kbAgentTaskContext';
import type { KbDocumentAnalysisTaskContext } from './kbDocumentAnalysisApi';
import {
  parseKbRestructureClarificationQuestions,
  type KbRestructureClarificationQuestion,
} from './kbDocumentRestructureWorkflow';

export type { KbRestructureClarificationQuestion };

type KbRestructureApiBase = {
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

async function postKbRestructureAction<T>(
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

function parseRestructureResult(body: Record<string, unknown>): {
  documentRestructuredMarkdown: string;
  documentRestructureNotesMarkdown: string;
  clarificationQuestions: KbRestructureClarificationQuestion[];
} {
  const data =
    typeof body.documentRestructuredMarkdown === 'string'
      ? body.documentRestructuredMarkdown.trim()
      : '';
  if (!data) throw new Error('Risposta non valida: documentRestructuredMarkdown mancante.');
  const notes =
    typeof body.documentRestructureNotesMarkdown === 'string'
      ? body.documentRestructureNotesMarkdown.trim()
      : '';
  const clarificationQuestions = parseKbRestructureClarificationQuestions(
    body.clarificationQuestions
  );
  return { documentRestructuredMarkdown: data, documentRestructureNotesMarkdown: notes, clarificationQuestions };
}

/** Prima proposta: documento sorgente → dati puliti + note meta (tab Analisi). */
export async function proposeKbDocumentRestructure(
  params: KbRestructureApiBase
): Promise<{
  documentRestructuredMarkdown: string;
  documentRestructureNotesMarkdown: string;
  clarificationQuestions: KbRestructureClarificationQuestion[];
}> {
  return postKbRestructureAction(
    'kb_propose_document_restructure',
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
      params.purposeOverride ?? 'KB_PROPOSE_DOCUMENT_RESTRUCTURE'
    ),
    parseRestructureResult
  );
}

/** Raffina bozza designer del documento riformattato (solo tabella dati). */
export async function refineKbDocumentRestructure(
  params: KbRestructureApiBase & { draftMarkdown: string }
): Promise<{
  documentRestructuredMarkdown: string;
  documentRestructureNotesMarkdown: string;
  clarificationQuestions: KbRestructureClarificationQuestion[];
}> {
  return postKbRestructureAction(
    'kb_refine_document_restructure',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        documentSampleText: params.documentSampleText ?? '',
        draftMarkdown: params.draftMarkdown,
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_REFINE_DOCUMENT_RESTRUCTURE'
    ),
    parseRestructureResult
  );
}

export type KbRestructureFeedbackWire = {
  rowNotes: Readonly<Record<string, string>>;
  questionAnswers: ReadonlyArray<{ id: string; question: string; answer: string }>;
  designerFeedback: string;
};

/** Raffina tabella incorporando note riga, risposte e osservazioni designer. */
export async function refineKbDocumentRestructureWithFeedback(
  params: KbRestructureApiBase & {
    draftMarkdown: string;
    feedback: KbRestructureFeedbackWire;
  }
): Promise<{
  documentRestructuredMarkdown: string;
  documentRestructureNotesMarkdown: string;
  clarificationQuestions: KbRestructureClarificationQuestion[];
}> {
  return postKbRestructureAction(
    'kb_refine_document_restructure_with_feedback',
    applyCallMeta(
      {
        projectId: params.projectId,
        repositoryDocumentId: params.repositoryDocumentId,
        documentName: params.documentName,
        documentSampleText: params.documentSampleText ?? '',
        draftMarkdown: params.draftMarkdown,
        rowNotes: params.feedback.rowNotes,
        questionAnswers: params.feedback.questionAnswers,
        designerFeedback: params.feedback.designerFeedback,
        ...taskContextFields(params.taskContext),
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'KB_REFINE_DOCUMENT_RESTRUCTURE_WITH_FEEDBACK'
    ),
    parseRestructureResult
  );
}

export type { KbTaskVariableWire };
