/**
 * Registry of workspace providers (ElevenLabs first; extensible).
 */

import type { WorkspaceProvider } from './WorkspaceProvider';
import type { WorkspaceProviderId } from './types';

const providers = new Map<WorkspaceProviderId, WorkspaceProvider>();

export function registerWorkspaceProvider(provider: WorkspaceProvider): void {
  providers.set(provider.id, provider);
}

export function getWorkspaceProvider(id: WorkspaceProviderId): WorkspaceProvider | undefined {
  return providers.get(id);
}

export function listWorkspaceProviders(): readonly WorkspaceProvider[] {
  return [...providers.values()];
}
