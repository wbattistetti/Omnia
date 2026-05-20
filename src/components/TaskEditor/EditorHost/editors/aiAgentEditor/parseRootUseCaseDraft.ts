/**
 * Root composer draft: LLM decides 1..N use cases from meaning; mechanical split is emergency fallback only.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { getScenarioText } from '@domain/aiAgentUseCase/scenarioText';

/** Max root use cases per Enter (fail-fast guardrail). */
export const ROOT_USE_CASE_BATCH_MAX = 30;

/** Minimum draft length to call the split LLM when an API is available. */
export const ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS = 8;

/** Emergency fallback: split on line breaks, comma, or semicolon. */
const ROOT_BATCH_SPLIT_FALLBACK = /[;,\r\n]+/;

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

/**
 * Splits draft text into segment labels (trimmed, non-empty) — fallback when LLM is unavailable.
 */
export function parseRootUseCaseDraftSegmentsFallback(raw: string): string[] {
  return String(raw || '')
    .split(ROOT_BATCH_SPLIT_FALLBACK)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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

export interface ResolveRootUseCaseDraftResult {
  labels: string[];
  skippedCount: number;
  usedLlm: boolean;
}

export interface ResolveRootUseCaseDraftParams {
  raw: string;
  catalog: readonly AIAgentUseCase[];
  /** When set and draft length >= {@link ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS}, always used first. */
  splitApi?: (draft: string) => Promise<string[]>;
}

/**
 * Resolves pasted root draft into labels to create: LLM split when possible, then local dedup.
 */
export async function resolveRootUseCaseDraftForCreateAsync(
  params: ResolveRootUseCaseDraftParams
): Promise<ResolveRootUseCaseDraftResult> {
  const trimmed = String(params.raw || '').trim();
  if (!trimmed) {
    return { labels: [], skippedCount: 0, usedLlm: false };
  }

  const catalogKeys = buildExistingRootDraftDedupKeys(params.catalog);
  let segments: string[];
  let usedLlm = false;

  if (trimmed.length >= ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS && params.splitApi) {
    usedLlm = true;
    try {
      const fromLlm = await params.splitApi(trimmed);
      segments = Array.isArray(fromLlm)
        ? fromLlm.map((s) => String(s || '').trim()).filter((s) => s.length > 0)
        : [];
    } catch {
      segments =
        trimmed.length > 0 ? parseRootUseCaseDraftSegmentsFallback(trimmed) : [trimmed];
    }
  } else if (trimmed.length >= ROOT_USE_CASE_DRAFT_MIN_LLM_CHARS) {
    segments = parseRootUseCaseDraftSegmentsFallback(trimmed);
  } else {
    segments = [trimmed];
  }

  if (segments.length > ROOT_USE_CASE_BATCH_MAX) {
    segments = segments.slice(0, ROOT_USE_CASE_BATCH_MAX);
  }

  const { toCreate, skippedCount } = dedupeRootDraftLabels(segments, catalogKeys);
  return { labels: toCreate, skippedCount, usedLlm };
}
