/**
 * Applica sendHints al body JSON prima di invii HTTP (test API designer, ecc.).
 */

import type { AgentBackendOutputSlotBindings } from './types';
import { applySendHintsToBody } from './applySendPathToBody';

/**
 * Merge hint nel body se path vuoto o ancora letterale surface.
 */
export function applyAgentSendHintsToJsonBody(
  body: Record<string, unknown>,
  bindings: AgentBackendOutputSlotBindings,
  options?: { referenceDate?: Date }
): number {
  const hints = bindings.sendHints ?? [];
  if (hints.length === 0) return 0;
  return applySendHintsToBody(body, hints, options);
}
