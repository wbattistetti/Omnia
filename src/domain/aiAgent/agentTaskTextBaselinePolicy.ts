/**
 * Policy for task text observation review: baseline is a snapshot, not accumulated revisions.
 *
 * - Baseline = last text stabilized by the agent (Create/Refine, finalize after observation review, load).
 * - Designer edits compare against that snapshot only.
 * - After IA applies agreed text, baseline resets to that output; structured sections get a clean base
 *   (no stacked deletedMask/inserts from the previous editing round).
 */

import { normalizeAnalysisText } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

/** True when designer draft differs from the last agent-stabilized baseline. */
export function taskTextDraftDiffersFromAgentBaseline(draft: string, baseline: string): boolean {
  const b = normalizeAnalysisText(baseline);
  if (!b) return false;
  return normalizeAnalysisText(draft) !== b;
}
