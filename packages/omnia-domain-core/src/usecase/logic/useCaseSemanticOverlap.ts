/**
 * Analisi semantica sovrapposizioni use case (duplicato / variante / nuovo).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { getScenarioText } from './scenarioText';

export type UseCaseOverlapClassification = 'duplicate' | 'variant' | 'new';

export type UseCaseOverlapRelation = 'duplicate_of' | 'variant_of';

export type UseCaseOverlapRelated = {
  readonly useCaseId: string;
  readonly catalogNumber?: number;
  readonly label: string;
  readonly relation: UseCaseOverlapRelation;
  readonly score: number;
  readonly reason?: string;
};

/** Hint persistito su `AIAgentUseCase.overlapHint` dopo analisi singola. */
export type UseCaseOverlapHint = {
  readonly classification: UseCaseOverlapClassification;
  readonly score: number;
  readonly primaryIntent?: string;
  readonly related: readonly UseCaseOverlapRelated[];
  readonly designerMessage: string;
  readonly analyzedAt?: string;
};

export type UseCaseOverlapPairResult = {
  readonly useCaseAId: string;
  readonly useCaseBId: string;
  readonly classification: UseCaseOverlapClassification;
  readonly score: number;
  readonly summary: string;
};

export type UseCaseOverlapCluster = {
  readonly clusterId: string;
  readonly useCaseIds: readonly string[];
  readonly classification: UseCaseOverlapClassification;
  readonly headline: string;
  readonly pairs: readonly UseCaseOverlapPairResult[];
};

export type UseCaseOverlapReport = {
  readonly threshold: number;
  readonly pairCount: number;
  readonly clusters: readonly UseCaseOverlapCluster[];
  readonly generatedAt: string;
};

export const DEFAULT_USE_CASE_OVERLAP_THRESHOLD = 0.8;

export type UseCaseOverlapSnapshot = {
  readonly id: string;
  readonly label: string;
  readonly scenarioText: string;
  readonly assistantSnippet: string;
};

/** Estrae testo confrontabile per analisi overlap. */
export function buildUseCaseOverlapSnapshot(uc: AIAgentUseCase): UseCaseOverlapSnapshot {
  const assistant = uc.dialogue?.find((t) => t.role === 'assistant');
  return {
    id: uc.id,
    label: (uc.label ?? '').trim() || uc.id,
    scenarioText: getScenarioText(uc).trim(),
    assistantSnippet: (assistant?.content ?? '').trim().slice(0, 600),
  };
}

function parseClassification(raw: unknown): UseCaseOverlapClassification {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'duplicate' || s === 'duplicato') return 'duplicate';
  if (s === 'variant' || s === 'variante') return 'variant';
  return 'new';
}

function parseRelation(raw: unknown): UseCaseOverlapRelation {
  const s = String(raw ?? '').trim().toLowerCase();
  return s === 'duplicate_of' || s === 'duplicato' ? 'duplicate_of' : 'variant_of';
}

function clampScore(n: unknown): number {
  const x = typeof n === 'number' ? n : Number.parseFloat(String(n ?? ''));
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

/** Parse campo `overlapHint` da JSON persistito. */
export function parseOverlapHintField(raw: unknown): UseCaseOverlapHint | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const relatedRaw = Array.isArray(o.related) ? o.related : [];
  const related: UseCaseOverlapRelated[] = [];
  for (const row of relatedRaw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const useCaseId = typeof r.useCaseId === 'string' ? r.useCaseId.trim() : '';
    if (!useCaseId) continue;
    const label = typeof r.label === 'string' ? r.label.trim() : useCaseId;
    related.push({
      useCaseId,
      ...(typeof r.catalogNumber === 'number' && r.catalogNumber > 0
        ? { catalogNumber: Math.floor(r.catalogNumber) }
        : {}),
      label,
      relation: parseRelation(r.relation),
      score: clampScore(r.score),
      ...(typeof r.reason === 'string' && r.reason.trim() ? { reason: r.reason.trim() } : {}),
    });
  }
  const designerMessage =
    typeof o.designerMessage === 'string' ? o.designerMessage.trim() : '';
  if (!designerMessage && related.length === 0) return undefined;
  return {
    classification: parseClassification(o.classification),
    score: clampScore(o.score),
    ...(typeof o.primaryIntent === 'string' && o.primaryIntent.trim()
      ? { primaryIntent: o.primaryIntent.trim() }
      : {}),
    related,
    designerMessage:
      designerMessage ||
      formatOverlapDesignerMessage(
        {
          classification: parseClassification(o.classification),
          score: clampScore(o.score),
          related,
          designerMessage: '',
        },
        new Map(related.map((r) => [r.useCaseId, r.catalogNumber]))
      ),
    ...(typeof o.analyzedAt === 'string' && o.analyzedAt.trim()
      ? { analyzedAt: o.analyzedAt.trim() }
      : {}),
  };
}

/** Messaggio designer sotto scenario (payoff overlap). */
export function formatOverlapDesignerMessage(
  hint: Pick<UseCaseOverlapHint, 'classification' | 'related' | 'designerMessage'>,
  catalogNumberById: ReadonlyMap<string, number | undefined>
): string {
  if (hint.designerMessage?.trim()) return hint.designerMessage.trim();
  const top = hint.related[0];
  if (!top) {
    if (hint.classification === 'new') return 'Use case distinto: nessuna sovrapposizione rilevante nel catalogo.';
    return '';
  }
  const num = catalogNumberById.get(top.useCaseId) ?? top.catalogNumber;
  const prefix = num ? `UC ${num}` : top.label;
  if (hint.classification === 'duplicate') {
    return `Attenzione: già coperto da ${prefix} — ${top.label}.`;
  }
  if (hint.classification === 'variant') {
    return `Attenzione: variante / sovrapposizione parziale con ${prefix} — ${top.label}.`;
  }
  return '';
}

export function overlapClassificationLabel(
  c: UseCaseOverlapClassification
): 'Duplicato' | 'Variante' | 'Nuovo' {
  if (c === 'duplicate') return 'Duplicato';
  if (c === 'variant') return 'Variante';
  return 'Nuovo';
}

/**
 * Stub locale: classificazione `new` finché il backend non risponde.
 * Le funzioni `analyzeUseCase` / `checkOverlap` / `generateReport` vivono in `src/domain/useCaseOverlap/useCaseOverlapApi.ts`.
 */
export function buildPendingOverlapHint(): UseCaseOverlapHint {
  return {
    classification: 'new',
    score: 0,
    related: [],
    designerMessage: '',
    analyzedAt: new Date().toISOString(),
  };
}
