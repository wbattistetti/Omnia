/**
 * Stable equality for {@link AgentReviewBackendSnapshot} sync (portal store ↔ ProjectData).
 */

import type { AgentReviewBackendSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';

export function reviewBackendSnapshotsEqual(
  a: AgentReviewBackendSnapshot | null | undefined,
  b: AgentReviewBackendSnapshot | null | undefined
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
