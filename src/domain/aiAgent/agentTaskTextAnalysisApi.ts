/**
 * Client API: revisione osservazioni su testi task (descrizione + sezioni strutturate).
 */

import type { AiCallMeta } from '@services/aiAgentDesignApi';
import { parseDesignApiJsonResponse } from '@services/designApiResponse';
import { designAiFetch } from '@services/designAiRequestPipeline';
import {
  excerptDuplicatesDesignerNote,
  sanitizeDocumentExcerpt,
} from '@domain/knowledgeBase/kbDocumentExcerptValidation';
import {
  parseKbAnalysisObservationReview,
  type KbAnalysisObservation,
  type KbAnalysisObservationReview,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import type { AgentTaskTextFieldId } from './agentTaskTextFieldIds';
import { agentTaskTextFieldLabel } from './agentTaskTextFieldIds';

type AgentTaskTextApiBase = {
  projectId: string;
  fieldId: AgentTaskTextFieldId;
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

async function postAgentTaskTextAction<T>(
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

function sectionLabel(fieldId: AgentTaskTextFieldId): string {
  return agentTaskTextFieldLabel(fieldId);
}

/** Confronta baseline agente vs bozza designer; estrae osservazioni. */
export async function reviewAgentTaskTextObservations(
  params: AgentTaskTextApiBase & {
    agentBaselineMarkdown: string;
    userDraftMarkdown: string;
  }
): Promise<KbAnalysisObservationReview> {
  const draft = params.userDraftMarkdown;
  return postAgentTaskTextAction(
    'agent_review_task_text_observations',
    applyCallMeta(
      {
        projectId: params.projectId,
        fieldId: params.fieldId,
        sectionLabel: sectionLabel(params.fieldId),
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: draft,
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'AGENT_REVIEW_TASK_TEXT_OBSERVATIONS'
    ),
    (body) => parseKbAnalysisObservationReview(body, params.agentBaselineMarkdown)
  );
}

/** Riscrive la risposta agente dopo correzione designer su un punto. */
export async function clarifyAgentTaskTextObservation(
  params: AgentTaskTextApiBase & {
    agentBaselineMarkdown: string;
    userText: string;
    previousInterpretation: string;
    userCorrection: string;
    userDraftMarkdown: string;
  }
): Promise<{
  interpretation: string;
  documentExcerpt?: string;
  excerptRationale?: string;
}> {
  return postAgentTaskTextAction(
    'agent_clarify_task_text_observation',
    applyCallMeta(
      {
        projectId: params.projectId,
        fieldId: params.fieldId,
        sectionLabel: sectionLabel(params.fieldId),
        userText: params.userText,
        previousInterpretation: params.previousInterpretation,
        userCorrection: params.userCorrection,
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: params.userDraftMarkdown,
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'AGENT_CLARIFY_TASK_TEXT_OBSERVATION'
    ),
    (body) => {
      const interpretation =
        typeof body.interpretation === 'string' ? body.interpretation.trim() : '';
      if (!interpretation) {
        throw new Error('Risposta non valida: interpretation mancante.');
      }
      let documentExcerpt = sanitizeDocumentExcerpt(
        body.documentExcerpt,
        params.agentBaselineMarkdown
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

/** Testo finale concordato dopo conferma osservazioni. */
export async function finalizeAgentTaskText(
  params: AgentTaskTextApiBase & {
    agentBaselineMarkdown: string;
    userDraftMarkdown: string;
    observations: readonly KbAnalysisObservation[];
  }
): Promise<{ taskTextMarkdown: string }> {
  return postAgentTaskTextAction(
    'agent_finalize_task_text',
    applyCallMeta(
      {
        projectId: params.projectId,
        fieldId: params.fieldId,
        sectionLabel: sectionLabel(params.fieldId),
        agentBaselineMarkdown: params.agentBaselineMarkdown,
        userDraftMarkdown: params.userDraftMarkdown,
        observations: [...params.observations],
        provider: params.provider.toLowerCase(),
        model: params.model,
      },
      params.callMeta,
      params.purposeOverride ?? 'AGENT_FINALIZE_TASK_TEXT'
    ),
    (body) => {
      const text =
        typeof body.taskTextMarkdown === 'string' ? body.taskTextMarkdown.trim() : '';
      if (!text) throw new Error('Risposta non valida: taskTextMarkdown mancante.');
      return { taskTextMarkdown: text };
    }
  );
}
