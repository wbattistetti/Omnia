/**
 * Deterministic rules for the KB document analysis micro-workflow (no chat, explicit diff only).
 */

import {
  KB_ANALYSIS_EXECUTE_BUTTON,
  KB_ANALYSIS_UPDATE_BUTTON,
} from './kbDocumentAnalysisGuide';
import { sanitizeDocumentExcerpt } from './kbDocumentExcerptValidation';

export type KbAnalysisObservationKind =
  | 'aggiunta'
  | 'correzione'
  | 'contestazione'
  | 'precisazione';

export type KbAnalysisObservationPresentation = 'domanda' | 'osservazione';

export type KbAnalysisObservation = {
  readonly id: string;
  readonly kind: KbAnalysisObservationKind;
  readonly presentation: KbAnalysisObservationPresentation;
  readonly text: string;
  readonly interpretation: string;
  /** Citazione verbatim dal documento (validata server-side). */
  readonly documentExcerpt?: string;
  /** Breve spiegazione del legame excerpt → risposta. */
  readonly excerptRationale?: string;
  /** Nota utente dopo chiarimento, inclusa in finalize se presente. */
  readonly userCorrectionNote?: string;
};

export type KbAnalysisObservationReview = {
  readonly observations: readonly KbAnalysisObservation[];
};

export type KbAnalysisObservationItemStatus = 'pending' | 'clarifying' | 'confirmed';

export type KbAnalysisReviewSessionItem = {
  observation: KbAnalysisObservation;
  status: KbAnalysisObservationItemStatus;
  clarificationDraft: string;
};

const OBSERVATION_KINDS: readonly KbAnalysisObservationKind[] = [
  'aggiunta',
  'correzione',
  'contestazione',
  'precisazione',
];

/** Normalizes markdown for equality checks (trim, CRLF → LF). */
export function normalizeAnalysisText(text: string): string {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/** True when the user draft differs from the last explicit agent baseline. */
export function analysisDraftDiffersFromBaseline(draft: string, baseline: string): boolean {
  const d = normalizeAnalysisText(draft);
  const b = normalizeAnalysisText(baseline);
  if (!b) return false;
  return d !== b;
}

/** Observation review runs only on an explicit agent/user diff. */
export function shouldRunObservationReview(baseline: string, draft: string): boolean {
  return analysisDraftDiffersFromBaseline(draft, baseline);
}

export function isKbAnalysisObservationKind(raw: unknown): raw is KbAnalysisObservationKind {
  return typeof raw === 'string' && (OBSERVATION_KINDS as readonly string[]).includes(raw);
}

export function isKbAnalysisObservationPresentation(
  raw: unknown
): raw is KbAnalysisObservationPresentation {
  return raw === 'domanda' || raw === 'osservazione';
}

export function inferObservationPresentation(
  kind: KbAnalysisObservationKind,
  text: string
): KbAnalysisObservationPresentation {
  const t = text.trim();
  if (kind === 'aggiunta' && /[?？]\s*$/.test(t)) return 'domanda';
  return 'osservazione';
}

function parseOneObservation(
  row: unknown,
  index: number,
  documentSample?: string
): KbAnalysisObservation | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id =
    typeof r.id === 'string' && r.id.trim() ? r.id.trim() : String.fromCharCode(65 + index);
  const kind = r.kind;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  const interpretation = typeof r.interpretation === 'string' ? r.interpretation.trim() : '';
  if (!isKbAnalysisObservationKind(kind) || !text || !interpretation) return null;
  const presentation = isKbAnalysisObservationPresentation(r.presentation)
    ? r.presentation
    : inferObservationPresentation(kind, text);
  const userCorrectionNote =
    typeof r.userCorrectionNote === 'string' && r.userCorrectionNote.trim()
      ? r.userCorrectionNote.trim()
      : undefined;
  const documentExcerpt = documentSample
    ? sanitizeDocumentExcerpt(r.documentExcerpt, documentSample)
    : typeof r.documentExcerpt === 'string' && r.documentExcerpt.trim()
      ? r.documentExcerpt.trim().slice(0, 2_000)
      : undefined;
  const excerptRationale =
    documentExcerpt &&
    typeof r.excerptRationale === 'string' &&
    r.excerptRationale.trim()
      ? r.excerptRationale.trim().slice(0, 500)
      : undefined;
  return {
    id,
    kind,
    presentation,
    text,
    interpretation,
    ...(documentExcerpt ? { documentExcerpt } : {}),
    ...(excerptRationale ? { excerptRationale } : {}),
    userCorrectionNote,
  };
}

/** Validates and normalizes the observation review payload from the backend. */
export function parseKbAnalysisObservationReview(
  raw: unknown,
  documentSample?: string
): KbAnalysisObservationReview {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Risposta non valida: payload osservazioni mancante.');
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.observations) || o.observations.length === 0) {
    throw new Error('Risposta non valida: nessuna osservazione rilevata.');
  }
  const observations: KbAnalysisObservation[] = [];
  o.observations.forEach((row, index) => {
    const parsed = parseOneObservation(row, index, documentSample);
    if (parsed) observations.push(parsed);
  });
  if (observations.length === 0) {
    throw new Error('Risposta non valida: osservazioni non parseabili.');
  }
  return { observations };
}

/** Session items from a fresh review response. */
export function createReviewSessionItems(
  review: KbAnalysisObservationReview
): KbAnalysisReviewSessionItem[] {
  return review.observations.map((observation) => ({
    observation,
    status: 'pending',
    clarificationDraft: '',
  }));
}

export function allReviewItemsConfirmed(items: readonly KbAnalysisReviewSessionItem[]): boolean {
  return items.length > 0 && items.every((item) => item.status === 'confirmed');
}

export function countConfirmedReviewItems(items: readonly KbAnalysisReviewSessionItem[]): number {
  return items.filter((item) => item.status === 'confirmed').length;
}

/** Observations payload for finalize (includes correction notes when set). */
export function observationsForFinalize(
  items: readonly KbAnalysisReviewSessionItem[]
): KbAnalysisObservation[] {
  return items.map((item) => item.observation);
}

export type KbAnalysisActionLabel =
  | typeof KB_ANALYSIS_EXECUTE_BUTTON
  | typeof KB_ANALYSIS_UPDATE_BUTTON;

export type KbAnalysisToolbarPresentation = {
  executeVisible: boolean;
  executeLabel: KbAnalysisActionLabel;
  executeEnabled: boolean;
  executeEmphasized: boolean;
};

/**
 * Toolbar «Esegui» / «Aggiorna»: visibile solo dopo edit manuale o in review;
 * «Esegui» solo prima della prima analisi agente, poi sempre «Aggiorna».
 */
export function resolveKbAnalysisToolbarPresentation(input: {
  baseline: string;
  draft: string;
  hasManualEdit: boolean;
  inReviewSession: boolean;
  allConfirmed: boolean;
  reviewHasDisagreement: boolean;
  canRunAgent: boolean;
}): KbAnalysisToolbarPresentation {
  const draftTrimmed = normalizeAnalysisText(input.draft);
  const hasBaseline = normalizeAnalysisText(input.baseline).length > 0;
  const userEditedDraft =
    input.hasManualEdit || analysisDraftDiffersFromBaseline(input.draft, input.baseline);

  const executeVisible =
    input.inReviewSession || (userEditedDraft && draftTrimmed.length > 0);

  const executeLabel: KbAnalysisActionLabel =
    hasBaseline || input.inReviewSession
      ? KB_ANALYSIS_UPDATE_BUTTON
      : KB_ANALYSIS_EXECUTE_BUTTON;

  const executeEnabled =
    input.canRunAgent &&
    draftTrimmed.length > 0 &&
    (input.inReviewSession ? input.allConfirmed : true);

  const executeEmphasized =
    executeVisible &&
    (analysisDraftDiffersFromBaseline(input.draft, input.baseline) ||
      input.reviewHasDisagreement ||
      (input.inReviewSession && input.allConfirmed) ||
      (!hasBaseline && input.hasManualEdit && draftTrimmed.length > 0));

  return { executeVisible, executeLabel, executeEnabled, executeEmphasized };
}
