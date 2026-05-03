/**
 * Bridge in-memory: ultima {@link IAAgentConfig} dell’editor AI Agent per taskId.
 * Usata da `ensureConvaiAgentsProvisioned` al Run così il merge tool (`convaiBackendToolTaskIds`) coincide
 * con il pannello anche prima che il debounce persist abbia scritto su `TaskRepository`.
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

const liveByTaskId = new Map<string, IAAgentConfig>();

export function registerConvaiLiveIaConfig(taskId: string, cfg: IAAgentConfig): void {
  const k = String(taskId || '').trim();
  if (!k) return;
  liveByTaskId.set(k, cfg);
}

export function unregisterConvaiLiveIaConfig(taskId: string): void {
  const k = String(taskId || '').trim();
  if (!k) return;
  liveByTaskId.delete(k);
}

/** Snapshot usato al provisioning pre-run (tab editor aperto). */
export function peekConvaiLiveIaConfig(taskId: string): IAAgentConfig | undefined {
  const k = String(taskId || '').trim();
  if (!k) return undefined;
  return liveByTaskId.get(k);
}

/** Merge piatto: `live` vince sui campi sovrapposti (stesso criterio del pannello «Agent setup»). */
export function mergeResolvedAndLiveIaConfig(
  resolved: IAAgentConfig,
  live: IAAgentConfig | null | undefined
): IAAgentConfig {
  if (!live) return resolved;
  return { ...resolved, ...live };
}
