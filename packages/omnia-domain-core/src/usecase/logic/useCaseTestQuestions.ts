/**
 * Domande di test per validazione use case (variazioni semantiche utente simulato).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export type UseCaseTestQuestionStatus = 'pending' | 'ok' | 'ko';

export type UseCaseTestQuestionKind =
  | 'direct'
  | 'colloquial'
  | 'abbreviated'
  | 'ambiguous';

/** Voce persistita in `AIAgentUseCase.testQuestions`. */
export type UseCaseTestQuestion = {
  id: string;
  text: string;
  expectedAnswer: string;
  status: UseCaseTestQuestionStatus;
  invalidationReason?: string;
  kind?: UseCaseTestQuestionKind;
  createdAt?: string;
};

export type UseCaseTestQuestionStats = {
  total: number;
  pending: number;
  ok: number;
  ko: number;
  reviewedPct: number;
  okPct: number;
  koPct: number;
};

export function newUseCaseTestQuestionId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeTestQuestionText(text: string): string {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseStatus(raw: unknown): UseCaseTestQuestionStatus {
  if (raw === 'ok' || raw === 'ko' || raw === 'pending') return raw;
  return 'pending';
}

function parseKind(raw: unknown): UseCaseTestQuestionKind | undefined {
  if (
    raw === 'direct' ||
    raw === 'colloquial' ||
    raw === 'abbreviated' ||
    raw === 'ambiguous'
  ) {
    return raw;
  }
  return undefined;
}

/** Parse array `testQuestions` da JSON persistito. */
export function parseTestQuestionsField(raw: unknown): UseCaseTestQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: UseCaseTestQuestion[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id =
      typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newUseCaseTestQuestionId();
    const text = typeof o.text === 'string' ? o.text.trim() : '';
    if (!text) continue;
    const expectedAnswer = typeof o.expectedAnswer === 'string' ? o.expectedAnswer : '';
    const status = parseStatus(o.status);
    const invalidationReason =
      typeof o.invalidationReason === 'string' && o.invalidationReason.trim()
        ? o.invalidationReason.trim()
        : undefined;
    const kind = parseKind(o.kind);
    const createdAt =
      typeof o.createdAt === 'string' && o.createdAt.trim() ? o.createdAt.trim() : undefined;
    out.push({
      id,
      text,
      expectedAnswer,
      status,
      ...(invalidationReason ? { invalidationReason } : {}),
      ...(kind ? { kind } : {}),
      ...(createdAt ? { createdAt } : {}),
    });
  }
  return out;
}

function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((n / total) * 100);
}

/** Statistiche aggregate per cruscotto toolbar. */
export function computeTestQuestionStats(
  useCases: readonly AIAgentUseCase[]
): UseCaseTestQuestionStats {
  let total = 0;
  let pending = 0;
  let ok = 0;
  let ko = 0;
  for (const uc of useCases) {
    for (const q of uc.testQuestions ?? []) {
      total++;
      if (q.status === 'ok') ok++;
      else if (q.status === 'ko') ko++;
      else pending++;
    }
  }
  const reviewed = ok + ko;
  return {
    total,
    pending,
    ok,
    ko,
    reviewedPct: pct(reviewed, total),
    okPct: pct(ok, total),
    koPct: pct(ko, total),
  };
}

/** Use case con almeno una domanda nel dato status. */
export function useCaseIdsWithTestQuestionStatus(
  useCases: readonly AIAgentUseCase[],
  status: 'ok' | 'ko'
): string[] {
  const ids: string[] = [];
  for (const uc of useCases) {
    const questions = uc.testQuestions ?? [];
    if (questions.some((q) => q.status === status)) ids.push(uc.id);
  }
  return ids;
}

/** Prima domanda (id + useCaseId) con status dato, ordine lista use case. */
export function findFirstTestQuestionAnchor(
  useCases: readonly AIAgentUseCase[],
  orderedIds: readonly string[],
  status: 'ok' | 'ko'
): { useCaseId: string; questionId: string } | null {
  for (const ucId of orderedIds) {
    const uc = useCases.find((u) => u.id === ucId);
    if (!uc) continue;
    const hit = (uc.testQuestions ?? []).find((q) => q.status === status);
    if (hit) return { useCaseId: uc.id, questionId: hit.id };
  }
  return null;
}

/** Append senza duplicati testuali (normalizzati). */
export function appendUniqueTestQuestions(
  existing: readonly UseCaseTestQuestion[],
  incoming: readonly UseCaseTestQuestion[]
): UseCaseTestQuestion[] {
  const seen = new Set(existing.map((q) => normalizeTestQuestionText(q.text)));
  const next = [...existing];
  for (const q of incoming) {
    const key = normalizeTestQuestionText(q.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(q);
  }
  return next;
}
