/**
 * Root composer draft: LLM decides 1..N use cases from meaning; mechanical split is emergency fallback only.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { getScenarioText } from '@domain/aiAgentUseCase/scenarioText';

/** Max root use cases per Enter (fail-fast guardrail). */
export const ROOT_USE_CASE_BATCH_MAX = 30;

/** Minimum draft length to call the split LLM when an API is available. */
export const ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS = 8;

/** Max chars per segment to treat semicolon-separated text as an intentional list. */
const FALLBACK_LIST_ITEM_MAX_CHARS = 120;

/** Max chars per segment for comma-separated short lists. */
const FALLBACK_COMMA_LIST_MAX_CHARS = 80;

/**
 * Normalizes text for duplicate detection (label, payoff, behavior, draft segment).
 */
export function normalizeRootUseCaseDraftDedupKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Keys already represented in the catalog (label, payoff, notes.behavior).
 */
export function buildExistingRootDraftDedupKeys(catalog: readonly AIAgentUseCase[]): Set<string> {
  const keys = new Set<string>();
  for (const uc of catalog) {
    const label = normalizeRootUseCaseDraftDedupKey(uc.label);
    if (label) keys.add(label);
    const payoff = normalizeRootUseCaseDraftDedupKey(getScenarioText(uc));
    if (payoff) keys.add(payoff);
    const behavior = normalizeRootUseCaseDraftDedupKey(uc.notes?.behavior ?? '');
    if (behavior) keys.add(behavior);
  }
  return keys;
}

function looksLikeListSegment(text: string, maxChars: number): boolean {
  const t = text.trim();
  if (!t || t.length > maxChars) return false;
  if (/[.!?]\s+\p{L}/u.test(t)) return false;
  return true;
}

/**
 * Emergency fallback when LLM split is unavailable.
 * Prefers newlines; splits on `;`/`,` only when segments look like a short list, not prose.
 */
export function parseRootUseCaseDraftSegmentsFallback(raw: string): string[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  if (/\r?\n/.test(trimmed)) {
    const lines = trimmed.split(/\r?\n+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (lines.length > 1) return lines;
  }

  if (trimmed.includes(';')) {
    const parts = trimmed.split(/[;]+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (
      parts.length > 1 &&
      parts.every((p) => looksLikeListSegment(p, FALLBACK_LIST_ITEM_MAX_CHARS))
    ) {
      return parts;
    }
  }

  if (trimmed.includes(',')) {
    const parts = trimmed.split(/,+/).map((s) => s.trim()).filter((s) => s.length > 0);
    if (
      parts.length >= 3 &&
      parts.every((p) => looksLikeListSegment(p, FALLBACK_COMMA_LIST_MAX_CHARS))
    ) {
      return parts;
    }
  }

  return [trimmed];
}

/** @deprecated Prefer {@link parseRootUseCaseDraftSegmentsFallback}; kept for tests and legacy imports. */
export const parseRootUseCaseDraftSegments = parseRootUseCaseDraftSegmentsFallback;

/**
 * Collapses separators into one segment per line for readable textarea display (blur only).
 */
export function normalizeRootUseCaseDraftDisplay(raw: string): string {
  return parseRootUseCaseDraftSegmentsFallback(raw).join('\n');
}

export interface DedupeRootDraftLabelsResult {
  toCreate: string[];
  skippedCount: number;
}

/**
 * Drops labels that duplicate catalog keys or repeat within the batch.
 */
export function dedupeRootDraftLabels(
  labels: readonly string[],
  catalogKeys: ReadonlySet<string>
): DedupeRootDraftLabelsResult {
  const seen = new Set<string>();
  const toCreate: string[] = [];
  let skippedCount = 0;
  for (const raw of labels) {
    const label = String(raw || '').trim();
    if (!label) continue;
    const key = normalizeRootUseCaseDraftDedupKey(label);
    if (!key) continue;
    if (catalogKeys.has(key) || seen.has(key)) {
      skippedCount += 1;
      continue;
    }
    seen.add(key);
    toCreate.push(label);
  }
  return { toCreate, skippedCount };
}

/** LLM / API result for semantic root draft split. */
export type SplitRootUseCaseDraftResult = {
  labels: string[];
  /** Draft label marked as session Start, if any. */
  startLabel: string | null;
};

export interface ResolveRootUseCaseDraftResult {
  labels: string[];
  skippedCount: number;
  usedLlm: boolean;
  /** Label to mark as Start after creation; null if none or deduped out. */
  startLabel: string | null;
}

export interface ResolveRootUseCaseDraftParams {
  raw: string;
  catalog: readonly AIAgentUseCase[];
  /** When set and draft length >= {@link ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS}, always used first. */
  splitApi?: (draft: string) => Promise<SplitRootUseCaseDraftResult>;
}

function resolveStartLabelFromText(
  startLabel: string | null | undefined,
  toCreate: readonly string[]
): string | null {
  const raw = String(startLabel ?? '').trim();
  if (!raw) return null;
  const key = normalizeRootUseCaseDraftDedupKey(raw);
  const match = toCreate.find((label) => normalizeRootUseCaseDraftDedupKey(label) === key);
  return match ?? null;
}

/**
 * Resolves pasted root draft into labels to create: LLM split when possible, then local dedup.
 */
export async function resolveRootUseCaseDraftForCreateAsync(
  params: ResolveRootUseCaseDraftParams
): Promise<ResolveRootUseCaseDraftResult> {
  const trimmed = String(params.raw || '').trim();
  if (!trimmed) {
    return { labels: [], skippedCount: 0, usedLlm: false, startLabel: null };
  }

  const catalogKeys = buildExistingRootDraftDedupKeys(params.catalog);
  let segments: string[] = [];
  let usedLlm = false;
  let llmStartLabel: string | null = null;

  if (trimmed.length >= ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS && params.splitApi) {
    usedLlm = true;
    try {
      const fromLlm = await params.splitApi(trimmed);
      segments = Array.isArray(fromLlm.labels)
        ? fromLlm.labels.map((s) => String(s || '').trim()).filter((s) => s.length > 0)
        : [];
      llmStartLabel = fromLlm.startLabel ?? null;
    } catch {
      segments = parseRootUseCaseDraftSegmentsFallback(trimmed);
    }
  } else if (trimmed.length >= ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS) {
    segments = parseRootUseCaseDraftSegmentsFallback(trimmed);
  } else {
    segments = [trimmed];
  }

  if (segments.length === 0 && trimmed.length > 0) {
    segments = [trimmed];
  }

  if (segments.length > ROOT_USE_CASE_BATCH_MAX) {
    segments = segments.slice(0, ROOT_USE_CASE_BATCH_MAX);
  }

  const { toCreate, skippedCount } = dedupeRootDraftLabels(segments, catalogKeys);
  const startLabel = resolveStartLabelFromText(llmStartLabel, toCreate);

  return { labels: toCreate, skippedCount, usedLlm, startLabel };
}
