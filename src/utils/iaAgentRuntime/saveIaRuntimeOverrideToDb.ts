/**
 * Direct HTTP persist for per-task IA runtime override.
 *
 * Writes `agentIaRuntimeOverrideJson` straight to Mongo via
 * `PUT /api/projects/:pid/tasks/:taskId` so the user never loses the
 * selection when the project has not been explicitly saved.
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { serializeIaAgentConfigForTaskPersistence } from './iaAgentConfigNormalize';

export type SaveIaRuntimeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Sends only `agentIaRuntimeOverrideJson` to the backend.
 * Lightweight: does not carry the full task payload, just the field that changed.
 */
export async function saveIaRuntimeOverrideToDb(
  projectId: string,
  taskId: string,
  config: IAAgentConfig
): Promise<SaveIaRuntimeResult> {
  if (!projectId?.trim() || !taskId?.trim()) {
    return { ok: false, error: 'projectId o taskId mancanti' };
  }
  const iaJson = serializeIaAgentConfigForTaskPersistence(config);
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentIaRuntimeOverrideJson: iaJson }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => String(res.status));
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
