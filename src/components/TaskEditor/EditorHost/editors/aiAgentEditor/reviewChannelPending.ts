/**
 * Stato per canale review: confronto locale vs remoto per audience (check multi-canale).
 */

import type { AgentReviewAudience } from '@domain/agentReviewChannel/reviewAudience';
import type { AgentReviewChannelDocument } from '@domain/agentReviewChannel/reviewDocument';
import type { BuildReviewDocumentParams } from '@domain/agentReviewChannel/reviewDocument';
import {
  buildAgentReviewDocument,
  canonicalReviewPayload,
  computeReviewContentHashAsync,
  summarizeReviewDiff,
} from '@domain/agentReviewChannel/reviewDocument';
import { fetchAgentReviewChannel } from '@services/agentReviewChannelApi';

export interface ReviewAudiencePendingStatus {
  audience: AgentReviewAudience;
  /** Documento remoto presente sul server. */
  hasRemote: boolean;
  /** Remoto diverso dal locale → review da importare. */
  hasPendingImport: boolean;
  summary: string | null;
  remoteUpdatedAt: string | null;
  remote: AgentReviewChannelDocument | null;
}

function diffSummaryText(
  local: BuildReviewDocumentParams,
  remote: AgentReviewChannelDocument
): string {
  const diff = summarizeReviewDiff(local, remote);
  const parts: string[] = [];
  if (diff.descriptionChanged) parts.push('descrizione');
  if (diff.modifiedScenarioCount > 0) parts.push(`${diff.modifiedScenarioCount} scenario`);
  if (diff.voteChanges > 0) parts.push(`${diff.voteChanges} voti`);
  return parts.length > 0 ? parts.join(', ') : 'revisione più recente';
}

export async function fetchReviewAudiencePendingStatus(
  audience: AgentReviewAudience,
  local: BuildReviewDocumentParams,
  projectId: string,
  taskInstanceId: string,
  token: string
): Promise<ReviewAudiencePendingStatus> {
  const empty: ReviewAudiencePendingStatus = {
    audience,
    hasRemote: false,
    hasPendingImport: false,
    summary: null,
    remoteUpdatedAt: null,
    remote: null,
  };
  try {
    const { document: remote, updatedAt } = await fetchAgentReviewChannel({
      projectId,
      taskInstanceId,
      audience,
      token,
    });
    if (!remote) return empty;
    const localDoc = buildAgentReviewDocument(local);
    const localHash = await computeReviewContentHashAsync(canonicalReviewPayload(localDoc));
    const pending = localHash !== remote.contentHash;
    return {
      audience,
      hasRemote: true,
      hasPendingImport: pending,
      summary: pending ? diffSummaryText(local, remote) : null,
      remoteUpdatedAt: updatedAt,
      remote: pending ? remote : null,
    };
  } catch {
    return empty;
  }
}

export function hasAnyPendingImport(statuses: readonly ReviewAudiencePendingStatus[]): boolean {
  return statuses.some((s) => s.hasPendingImport);
}

export function pendingStatusForAudience(
  statuses: readonly ReviewAudiencePendingStatus[],
  audience: AgentReviewAudience
): ReviewAudiencePendingStatus | undefined {
  return statuses.find((s) => s.audience === audience);
}
