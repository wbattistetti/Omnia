/**
 * Deterministic rules for the KB document analysis micro-workflow (no chat, explicit diff only).
 */

import {
  KB_ANALYSIS_EXECUTE_BUTTON,
  KB_ANALYSIS_REQUEST_REVIEW_BUTTON,
  KB_ANALYSIS_REVIEW_OBSERVATIONS_BUTTON,
  KB_ANALYSIS_UPDATE_BUTTON,
} from './kbDocumentAnalysisGuide';
import {
  excerptDuplicatesDesignerNote,
  sanitizeDocumentExcerpt,
} from './kbDocumentExcerptValidation';

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

/** Short chip label for designer note type (header, non-expandable). */
export function observationPresentationChipLabel(
  presentation: KbAnalysisObservationPresentation
): string {
  return presentation === 'domanda' ? 'Domanda' : 'Osservazione';
}

export function observationPresentationChipClassName(
  presentation: KbAnalysisObservationPresentation
): string {
  return presentation === 'domanda'
    ? 'border-amber-600/70 bg-amber-950/80 text-amber-100'
    : 'border-violet-600/60 bg-violet-950/70 text-violet-100';
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
  let documentExcerpt = documentSample
    ? sanitizeDocumentExcerpt(r.documentExcerpt, documentSample)
    : typeof r.documentExcerpt === 'string' && r.documentExcerpt.trim()
      ? r.documentExcerpt.trim().slice(0, 2_000)
      : undefined;
  if (documentExcerpt && excerptDuplicatesDesignerNote(documentExcerpt, text)) {
    documentExcerpt = undefined;
  }
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
  | typeof KB_ANALYSIS_REQUEST_REVIEW_BUTTON
  | typeof KB_ANALYSIS_REVIEW_OBSERVATIONS_BUTTON
  | typeof KB_ANALYSIS_UPDATE_BUTTON;

/** Fase del ciclo modifica → review osservazioni → aggiorna analisi. */
export type KbAnalysisActionPhase =
  | 'hidden'
  | 'request_review'
  | 'review_observations'
  | 'apply_update';

export type KbAnalysisToolbarPresentation = {
  phase: KbAnalysisActionPhase;
  executeVisible: boolean;
  executeLabel: KbAnalysisActionLabel;
  executeEnabled: boolean;
  executeEmphasized: boolean;
};

const PHASE_PRIORITY: Record<KbAnalysisActionPhase, number> = {
  hidden: 0,
  apply_update: 1,
  request_review: 2,
  review_observations: 3,
};

/**
 * Unisce più presentazioni (documento + sezioni): prevale la fase più «bloccante».
 */
export function mergeKbAnalysisToolbarPresentations(
  parts: readonly KbAnalysisToolbarPresentation[]
): KbAnalysisToolbarPresentation {
  const hidden: KbAnalysisToolbarPresentation = {
    phase: 'hidden',
    executeVisible: false,
    executeLabel: KB_ANALYSIS_UPDATE_BUTTON,
    executeEnabled: false,
    executeEmphasized: false,
  };
  if (parts.length === 0) return hidden;

  let best = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    const cur = parts[i]!;
    if (PHASE_PRIORITY[cur.phase] > PHASE_PRIORITY[best.phase]) {
      best = cur;
      continue;
    }
    if (cur.phase === best.phase) {
      best = {
        ...best,
        executeVisible: best.executeVisible || cur.executeVisible,
        executeEnabled: best.executeEnabled || cur.executeEnabled,
        executeEmphasized: best.executeEmphasized || cur.executeEmphasized,
      };
    }
  }
  return best;
}

/**
 * Toolbar analisi: visibile dopo edit; label per fase (Rivedi → Review osservazioni → Aggiorna).
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

  if (input.inReviewSession) {
    if (input.allConfirmed) {
      return {
        phase: 'apply_update',
        executeVisible: true,
        executeLabel: KB_ANALYSIS_UPDATE_BUTTON,
        executeEnabled: input.canRunAgent && draftTrimmed.length > 0,
        executeEmphasized: true,
      };
    }
    return {
      phase: 'review_observations',
      executeVisible: true,
      executeLabel: KB_ANALYSIS_REVIEW_OBSERVATIONS_BUTTON,
      executeEnabled: false,
      executeEmphasized: input.reviewHasDisagreement,
    };
  }

  if (!userEditedDraft || draftTrimmed.length === 0) {
    return {
      phase: 'hidden',
      executeVisible: false,
      executeLabel: hasBaseline ? KB_ANALYSIS_UPDATE_BUTTON : KB_ANALYSIS_EXECUTE_BUTTON,
      executeEnabled: false,
      executeEmphasized: false,
    };
  }

  if (!hasBaseline) {
    return {
      phase: 'request_review',
      executeVisible: true,
      executeLabel: KB_ANALYSIS_EXECUTE_BUTTON,
      executeEnabled: input.canRunAgent,
      executeEmphasized: true,
    };
  }

  return {
    phase: 'request_review',
    executeVisible: true,
    executeLabel: KB_ANALYSIS_REQUEST_REVIEW_BUTTON,
    executeEnabled: input.canRunAgent,
    executeEmphasized:
      analysisDraftDiffersFromBaseline(input.draft, input.baseline) || input.reviewHasDisagreement,
  };
}

/** Presentazione toolbar da stato sezioni Monaco (analisi backend / KB per ###). */
export function resolveSectionEditsToolbarPresentation(input: {
  pendingSectionCount: number;
  inReviewSession: boolean;
  allConfirmed: boolean;
  reviewHasDisagreement: boolean;
  canRunReview: boolean;
  readyToApplyCount: number;
}): KbAnalysisToolbarPresentation {
  if (input.inReviewSession) {
    if (input.allConfirmed && input.readyToApplyCount > 0) {
      return {
        phase: 'apply_update',
        executeVisible: true,
        executeLabel: KB_ANALYSIS_UPDATE_BUTTON,
        executeEnabled: input.canRunReview,
        executeEmphasized: true,
      };
    }
    return {
      phase: 'review_observations',
      executeVisible: true,
      executeLabel: KB_ANALYSIS_REVIEW_OBSERVATIONS_BUTTON,
      executeEnabled: false,
      executeEmphasized: input.reviewHasDisagreement,
    };
  }

  if (input.pendingSectionCount > 0) {
    return {
      phase: 'request_review',
      executeVisible: true,
      executeLabel: KB_ANALYSIS_REQUEST_REVIEW_BUTTON,
      executeEnabled: input.canRunReview,
      executeEmphasized: true,
    };
  }

  return {
    phase: 'hidden',
    executeVisible: false,
    executeLabel: KB_ANALYSIS_UPDATE_BUTTON,
    executeEnabled: false,
    executeEmphasized: false,
  };
}
