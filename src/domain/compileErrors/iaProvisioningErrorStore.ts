/**
 * In-memory last provisioning failure per task (not persisted; avoids polluting Task JSON).
 */

import type { NormalizedIaProviderError } from './iaProviderErrors';

const byTaskId = new Map<string, NormalizedIaProviderError>();

export function setIaProvisioningError(taskId: string, err: NormalizedIaProviderError | null): void {
  const id = taskId.trim();
  if (!id) return;
  if (err == null) byTaskId.delete(id);
  else byTaskId.set(id, err);
}

export function getIaProvisioningError(taskId: string): NormalizedIaProviderError | undefined {
  return byTaskId.get(taskId.trim());
}
