/**
 * Policy for task text observation review: baseline is a snapshot, not accumulated revisions.
 *
 * - Baseline = last text stabilized by the agent (Create/Refine, finalize after observation review, load).
 * - Designer edits compare against that snapshot only.
 * - After IA applies agreed text, baseline resets to that output; structured sections get a clean base
 *   (no stacked deletedMask/inserts from the previous editing round).
 */

import { normalizeAnalysisText } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

/** Minimo delta parole (aggiunte+rimosse) per proporre revisione osservazioni. */
export const AGENT_TASK_TEXT_MIN_WORD_DELTA = 2;

/** True when designer draft differs from the last agent-stabilized baseline. */
export function taskTextDraftDiffersFromAgentBaseline(draft: string, baseline: string): boolean {
  const b = normalizeAnalysisText(baseline);
  if (!b) return false;
  return normalizeAnalysisText(draft) !== b;
}

function tokenizeWords(text: string): string[] {
  return normalizeAnalysisText(text)
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((w) => w.length > 0);
}

/** Conteggio parole aggiunte/rimosse rispetto alla baseline (multiset). */
export function countAgentTaskTextWordDelta(baseline: string, draft: string): number {
  const bWords = tokenizeWords(baseline);
  const dWords = tokenizeWords(draft);
  const bCount = new Map<string, number>();
  for (const w of bWords) bCount.set(w, (bCount.get(w) ?? 0) + 1);
  const dCount = new Map<string, number>();
  for (const w of dWords) dCount.set(w, (dCount.get(w) ?? 0) + 1);
  let delta = 0;
  const keys = new Set([...bCount.keys(), ...dCount.keys()]);
  for (const k of keys) {
    delta += Math.abs((bCount.get(k) ?? 0) - (dCount.get(k) ?? 0));
  }
  return delta;
}

export type AgentTaskTextOfferReviewInput = {
  baseline: string;
  draft: string;
  /** Agente già creato almeno una volta. */
  hasAgentGeneration: boolean;
  /** L'utente ha digitato/modificato manualmente il campo (non sync IA/tab). */
  hasManualEdit: boolean;
};

/**
 * True quando mostrare il toaster «analizziamo le modifiche»:
 * post-creazione agente, edit manuale, baseline agente presente, diff significativo (≥ parole min).
 */
export function shouldAgentTaskTextOfferReview(input: AgentTaskTextOfferReviewInput): boolean {
  if (!input.hasAgentGeneration) return false;
  if (!input.hasManualEdit) return false;
  if (!normalizeAnalysisText(input.baseline)) return false;
  if (!taskTextDraftDiffersFromAgentBaseline(input.draft, input.baseline)) return false;
  return countAgentTaskTextWordDelta(input.baseline, input.draft) >= AGENT_TASK_TEXT_MIN_WORD_DELTA;
}
