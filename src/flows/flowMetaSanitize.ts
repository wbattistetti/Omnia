/**
 * Rimuove il campo legacy `variables` da `flow.meta` (non più usato; variabili reali in VariableCreationService).
 */

import type { Flow } from './FlowTypes';

export function stripLegacyVariablesFromFlowMeta(meta: unknown): Flow['meta'] | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const o = { ...(meta as Record<string, unknown>) };
  delete o.variables;
  return Object.keys(o).length > 0 ? (o as Flow['meta']) : undefined;
}
