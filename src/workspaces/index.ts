/**
 * Omnia third-party workspaces: remote agent platforms mirrored for design-time edit + publish.
 */

import { registerWorkspaceProvider } from './core/registry';
import { ElevenLabsWorkspaceProvider } from './elevenlabs/ElevenLabsWorkspaceProvider';

let bootstrapped = false;

/** Idempotent registration of built-in workspace providers. */
export function ensureWorkspacesBootstrapped(): void {
  if (bootstrapped) return;
  registerWorkspaceProvider(new ElevenLabsWorkspaceProvider());
  bootstrapped = true;
}

export * from './core';
export * from './elevenlabs';
