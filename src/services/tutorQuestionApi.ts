/**
 * Active Tutor — API client domande libere (risposta JSON strutturata).
 */

import { designAiFetch } from '@services/designAiRequestPipeline';
import type { AiCallMeta } from '@services/aiAgentDesignApi';
import type { TutorStructuredMessage } from '@domain/activeTutor/tutorStructuredMessage';
import { allTutorUiIds, UI_IDS } from '@domain/activeTutor/tutorUiIds';
import { parseTutorStructuredResponse } from '@domain/activeTutor/tutorStructuredMessage';
import {
  markExpressBackendAvailable,
  markExpressBackendUnavailable,
  parseExpressApiErrorBody,
} from '@services/expressBackendReachability';

export interface TutorQuestionRequest {
  question: string;
  currentPhaseLabel: string;
  detectedPhaseLabel?: string;
  currentState: string;
  provider: string;
  model: string;
  callMeta?: AiCallMeta;
}

export interface TutorQuestionResponse {
  inManual: boolean;
  message: TutorStructuredMessage | null;
}

const ALLOWED_UI = allTutorUiIds();

export async function askTutorQuestionApi(
  req: TutorQuestionRequest
): Promise<TutorQuestionResponse> {
  const res = await designAiFetch('/design/tutor-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    markExpressBackendUnavailable(res.status);
    throw new Error(parseExpressApiErrorBody(res.status, errText));
  }
  markExpressBackendAvailable();
  const raw = (await res.json()) as { inManual?: boolean; message?: unknown };
  if (raw.inManual !== true) {
    return { inManual: false, message: null };
  }
  const parsed = parseTutorStructuredResponse(raw.message, ALLOWED_UI);
  if (!parsed) {
    return { inManual: false, message: null };
  }
  return { inManual: true, message: parsed };
}

/** Messaggio errore configurazione modello (non LLM). */
export function tutorMissingModelStructured(): TutorStructuredMessage {
  return {
    title: 'Modello IA mancante',
    body: 'Per rispondere alle domande serve un modello IA configurato in Omnia Tutor (Impostazioni).',
    actions: [],
    uiRefs: [],
    ensureView: null,
  };
}

/** Messaggio errore rete/generico. */
export function tutorErrorStructured(detail: string): TutorStructuredMessage {
  return {
    title: 'Errore',
    body: detail,
    actions: [],
    uiRefs: [],
    ensureView: null,
  };
}

export { UI_IDS };
