/**
 * Contract for a third-party ConvAI / agent workspace mirrored inside Omnia.
 */

import type {
  RemoteAgentRef,
  WorkspaceAgentSnapshot,
  WorkspaceProviderId,
  WorkspaceTaskBinding,
} from './types';

export type { WorkspaceProviderId };

export type ListRemoteAgentsResult = {
  agents: readonly { agentId: string; name: string }[];
  nextCursor: string | null;
  hasMore: boolean;
};

export interface WorkspaceProvider {
  readonly id: WorkspaceProviderId;
  readonly displayName: string;

  listAgents(params?: {
    pageSize?: number;
    cursor?: string | null;
    search?: string | null;
  }): Promise<ListRemoteAgentsResult>;

  getAgent(ref: RemoteAgentRef): Promise<WorkspaceAgentSnapshot>;

  /**
   * Partial update of remote agent configuration (provider-specific body shape).
   */
  patchAgent(ref: RemoteAgentRef, body: Record<string, unknown>): Promise<void>;
}

export function remoteAgentRef(
  providerId: WorkspaceProviderId,
  agentId: string,
  name?: string
): RemoteAgentRef {
  return {
    providerId,
    agentId: String(agentId || '').trim(),
    ...(name?.trim() ? { name: name.trim() } : {}),
  };
}

export function isWorkspaceTaskBinding(value: unknown): value is WorkspaceTaskBinding {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.providerId === 'string' &&
    o.providerId.trim().length > 0 &&
    typeof o.remoteAgentId === 'string' &&
    o.remoteAgentId.trim().length > 0
  );
}
