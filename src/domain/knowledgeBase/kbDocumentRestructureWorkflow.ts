/**
 * Workflow tab Documento riformattato: chiavi riga, domande IA, feedback designer.
 */

export type KbRestructureClarificationQuestion = {
  readonly id: string;
  readonly text: string;
  readonly relatedRowKeys?: readonly string[];
  /** Risposta designer (persistita). */
  answer?: string;
};

export type KbRestructureFeedbackPayload = {
  rowNotes: Readonly<Record<string, string>>;
  questions: readonly KbRestructureClarificationQuestion[];
  designerFeedback: string;
};

const EMPTY_CELL = new Set(['', '—', '-']);

function headerIndex(headers: readonly string[], name: string): number {
  const target = name.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === target);
}

function cellAt(row: readonly string[], index: number): string {
  if (index < 0) return '';
  return String(row[index] ?? '').trim();
}

function usableCell(value: string): boolean {
  return Boolean(value) && !EMPTY_CELL.has(value);
}

/** Chiave stabile per note riga (entity_id > code > label > indice). */
export function restructureRowKey(
  headers: readonly string[],
  row: readonly string[],
  rowIndex: number
): string {
  const entityIdx = headerIndex(headers, 'entity_id');
  const entityVal = cellAt(row, entityIdx);
  if (usableCell(entityVal)) return `entity:${entityVal}`;

  const codeIdx = headerIndex(headers, 'code');
  const codeVal = cellAt(row, codeIdx);
  if (usableCell(codeVal)) return `code:${codeVal}`;

  const labelIdx = headerIndex(headers, 'label');
  const labelVal = cellAt(row, labelIdx);
  if (usableCell(labelVal)) return `label:${labelVal.slice(0, 80)}`;

  return `row:${rowIndex}`;
}

export function parseKbRestructureClarificationQuestions(raw: unknown): KbRestructureClarificationQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: KbRestructureClarificationQuestion[] = [];
  for (let i = 0; i < raw.length && out.length < 12; i += 1) {
    const row = raw[i];
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const text = typeof r.text === 'string' ? r.text.trim() : '';
    if (!text) continue;
    const id =
      typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `q${i + 1}`;
    const relatedRowKeys = Array.isArray(r.relatedRowKeys)
      ? r.relatedRowKeys
          .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k) => k.trim())
          .slice(0, 8)
      : undefined;
    out.push({
      id,
      text,
      ...(relatedRowKeys?.length ? { relatedRowKeys } : {}),
    });
  }
  return out;
}

function normalizeRowNotes(raw: Readonly<Record<string, string>> | undefined): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const note = String(value ?? '').trim();
    if (key.trim() && note) out[key.trim()] = note;
  }
  return out;
}

function normalizeQuestions(
  questions: readonly KbRestructureClarificationQuestion[] | undefined
): KbRestructureClarificationQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q) => ({
      id: q.id.trim(),
      text: q.text.trim(),
      ...(q.relatedRowKeys?.length ? { relatedRowKeys: q.relatedRowKeys } : {}),
      ...(q.answer?.trim() ? { answer: q.answer.trim() } : {}),
    }))
    .filter((q) => q.id && q.text);
}

/** Snapshot deterministico del feedback corrente (per abilitare Aggiorna solo su delta). */
export function buildRestructureFeedbackSnapshot(payload: KbRestructureFeedbackPayload): string {
  const rowNotes = normalizeRowNotes(payload.rowNotes);
  const questions = answeredRestructureQuestions(payload.questions)
    .map((q) => ({ id: q.id, answer: q.answer!.trim() }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const designerFeedback = String(payload.designerFeedback ?? '').trim();
  return JSON.stringify({ rowNotes, questions, designerFeedback });
}

export function buildRestructureFeedbackPayload(doc: {
  documentRestructureRowNotes?: Readonly<Record<string, string>>;
  documentRestructureQuestions?: readonly KbRestructureClarificationQuestion[];
  documentRestructureDesignerFeedback?: string;
}): KbRestructureFeedbackPayload {
  return {
    rowNotes: normalizeRowNotes(doc.documentRestructureRowNotes),
    questions: normalizeQuestions(doc.documentRestructureQuestions),
    designerFeedback: String(doc.documentRestructureDesignerFeedback ?? '').trim(),
  };
}

/** True se c'è feedback non ancora applicato con l'ultimo refine. */
export function hasPendingRestructureFeedback(
  payload: KbRestructureFeedbackPayload,
  appliedSnapshot: string | undefined
): boolean {
  const current = buildRestructureFeedbackSnapshot(payload);
  if (!current || current === '{"rowNotes":{},"questions":[],"designerFeedback":""}') {
    return false;
  }
  if (!appliedSnapshot?.trim()) return true;
  return current !== appliedSnapshot.trim();
}

/** True se il payload contiene almeno un elemento di feedback compilato. */
export function restructureFeedbackHasContent(payload: KbRestructureFeedbackPayload): boolean {
  const snap = buildRestructureFeedbackSnapshot(payload);
  return snap !== '{"rowNotes":{},"questions":[],"designerFeedback":""}';
}

/** Domande con risposta non vuota (incluse nel refine). */
export function answeredRestructureQuestions(
  questions: readonly KbRestructureClarificationQuestion[]
): KbRestructureClarificationQuestion[] {
  return normalizeQuestions(questions).filter((q) => Boolean(q.answer?.trim()));
}

/** Domande IA ancora senza risposta. */
export function unansweredRestructureQuestions(
  questions: readonly KbRestructureClarificationQuestion[]
): KbRestructureClarificationQuestion[] {
  return normalizeQuestions(questions).filter((q) => !q.answer?.trim());
}

/** True se non ci sono domande aperte o tutte hanno risposta. */
export function allRestructureQuestionsAnswered(
  questions: readonly KbRestructureClarificationQuestion[]
): boolean {
  return unansweredRestructureQuestions(questions).length === 0;
}

/**
 * Remap note riga dopo edit griglia (priorità entity_id, fallback indice riga).
 */
export function remapRestructureRowNotes(
  prevHeaders: readonly string[],
  prevRows: readonly (readonly string[])[],
  nextHeaders: readonly string[],
  nextRows: readonly (readonly string[])[],
  notes: Readonly<Record<string, string>>
): Record<string, string> {
  if (!notes || Object.keys(notes).length === 0) return {};

  const prevKeys = prevRows.map((row, i) => restructureRowKey(prevHeaders, row, i));
  const entityIdxPrev = headerIndex(prevHeaders, 'entity_id');
  const entityIdxNext = headerIndex(nextHeaders, 'entity_id');

  const out: Record<string, string> = {};

  for (let i = 0; i < nextRows.length; i += 1) {
    const row = nextRows[i]!;
    const newKey = restructureRowKey(nextHeaders, row, i);
    let note = notes[newKey];

    if (!note && entityIdxPrev >= 0 && entityIdxNext >= 0) {
      const entityVal = cellAt(row, entityIdxNext);
      if (usableCell(entityVal)) {
        note = notes[`entity:${entityVal}`];
      }
    }

    if (!note && i < prevKeys.length) {
      note = notes[prevKeys[i]!];
    }

    if (note?.trim()) out[newKey] = note.trim();
  }

  return out;
}

export function formatColumnInstructionsForRefine(
  instructions: Readonly<Record<string, string>>
): string {
  const lines = Object.entries(instructions)
    .filter(([, text]) => String(text ?? '').trim())
    .map(([col, text]) => `- Colonna «${col}»: ${String(text).trim()}`);
  if (lines.length === 0) return '';
  return ['Istruzioni colonne (designer):', ...lines].join('\n');
}
