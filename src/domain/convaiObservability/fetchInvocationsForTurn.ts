/**
 * Fetch invocazioni runtime per finestra turno debugger (correlazione conversationId).
 */

import {
  fetchConvaiRuntimeInvocations,
  type FetchConvaiRuntimeInvocationsParams,
} from '@services/convaiRuntimeInvocationsApi';
import type { ConvaiRuntimeInvocationRecord } from './convaiRuntimeInvocationRecord';

export type FetchInvocationsForTurnParams = {
  conversationId: string;
  since?: string;
  until?: string;
  agentTaskId?: string;
  projectId?: string;
  limit?: number;
};

export async function fetchInvocationsForTurn(
  params: FetchInvocationsForTurnParams
): Promise<ConvaiRuntimeInvocationRecord[]> {
  const conversationId = String(params.conversationId ?? '').trim();
  if (!conversationId) return [];

  const filters: FetchConvaiRuntimeInvocationsParams = {
    conversationId,
    limit: params.limit ?? 50,
  };
  if (params.since?.trim()) filters.since = params.since.trim();
  if (params.until?.trim()) filters.until = params.until.trim();
  if (params.agentTaskId?.trim()) filters.agentTaskId = params.agentTaskId.trim();
  if (params.projectId?.trim()) filters.projectId = params.projectId.trim();

  const items = await fetchConvaiRuntimeInvocations(filters);
  return items.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}
