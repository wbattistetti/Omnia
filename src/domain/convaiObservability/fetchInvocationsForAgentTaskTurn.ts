/**
 * Fetch invocazioni runtime ConvAI per turno Test agente (senza conversationId obbligatorio).
 */

import {
  fetchConvaiRuntimeInvocations,
  type FetchConvaiRuntimeInvocationsParams,
} from '@services/convaiRuntimeInvocationsApi';
import type { ConvaiRuntimeInvocationRecord } from './convaiRuntimeInvocationRecord';

export type FetchInvocationsForAgentTaskTurnParams = {
  projectId: string;
  agentTaskId: string;
  since?: string;
  until?: string;
  kind?: FetchConvaiRuntimeInvocationsParams['kind'];
  limit?: number;
};

/** Invocazioni runtime filtrate per task agente e finestra temporale (Test agente / compiled-task). */
export async function fetchInvocationsForAgentTaskTurn(
  params: FetchInvocationsForAgentTaskTurnParams
): Promise<ConvaiRuntimeInvocationRecord[]> {
  const projectId = String(params.projectId ?? '').trim();
  const agentTaskId = String(params.agentTaskId ?? '').trim();
  if (!projectId || !agentTaskId) return [];

  const filters: FetchConvaiRuntimeInvocationsParams = {
    projectId,
    agentTaskId,
    limit: params.limit ?? 50,
  };
  if (params.since?.trim()) filters.since = params.since.trim();
  if (params.until?.trim()) filters.until = params.until.trim();
  if (params.kind?.trim()) filters.kind = params.kind.trim();

  const items = await fetchConvaiRuntimeInvocations(filters);
  return items.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

const RETRY_DELAY_MS = 280;

/**
 * Come {@link fetchInvocationsForAgentTaskTurn} con breve retry: il webhook può finire
 * pochi ms dopo l'SSE del messaggio bot.
 */
export async function fetchInvocationsForAgentTaskTurnWithRetry(
  params: FetchInvocationsForAgentTaskTurnParams,
  retries = 2
): Promise<ConvaiRuntimeInvocationRecord[]> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const items = await fetchInvocationsForAgentTaskTurn(params);
    if (items.length > 0) return items;
    if (attempt < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  return [];
}
