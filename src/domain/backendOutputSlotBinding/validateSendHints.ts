/**
 * Validazione compile: hint SEND vs allowlist OpenAPI e surface del catalogo.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { collectMappingsFromUseCases } from '@domain/useCaseBundle/semanticCompile';
import { isUnclassifiedSlotId, normalizeSurface } from '@domain/useCaseBundle/projectSlotLexicon';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import { buildSendPathAllowlist } from '@domain/openApi/backendSendParamCatalog';
import type { AgentBackendOutputSlotBindings } from './types';
import { isSendPathAllowed } from './surfaceSendHints';
import {
  buildParameterDestinationCatalog,
  findDestinationForSendHint,
} from './parameterDestinationTree';
import type { BackendSendLeavesGroup } from './collectBackendSendLeavesByTask';

export type SendHintValidationStatus = 'valid' | 'invalid' | 'skipped';

export interface SendHintValidationResult {
  status: SendHintValidationStatus;
  reasons: string[];
}

const SEND_SLOT_IDS = new Set(['data', 'datarelativa', 'orario', 'mese', 'giornosettimana']);

/**
 * Valida hint SEND quando esistono leaf OpenAPI da almeno un backend collegato.
 */
export function validateSendHints(
  useCases: readonly AIAgentUseCase[],
  bindings: AgentBackendOutputSlotBindings,
  leaves: readonly BackendSendParamLeaf[],
  backendLinked: boolean,
  options?: { backendGroups?: readonly BackendSendLeavesGroup[] }
): SendHintValidationResult {
  if (!backendLinked || leaves.length === 0) {
    return { status: 'skipped', reasons: [] };
  }

  const reasons: string[] = [];
  const hints = bindings.sendHints ?? [];
  const allowlist = buildSendPathAllowlist(leaves);

  let invalidPaths = 0;
  for (const h of hints) {
    if (!isSendPathAllowed(h.sendPath, leaves)) invalidPaths += 1;
  }
  if (invalidPaths > 0) {
    reasons.push(`${invalidPaths} hint SEND con path fuori OpenAPI`);
  }

  const groups = options?.backendGroups ?? [];
  if (groups.length > 0 && hints.length > 0) {
    const catalog = buildParameterDestinationCatalog(groups);
    let offCatalog = 0;
    for (const h of hints) {
      if (!h.sendPath?.trim()) continue;
      if (!findDestinationForSendHint(catalog, h)) offCatalog += 1;
    }
    if (offCatalog > 0) {
      reasons.push(`${offCatalog} hint SEND non nel catalogo destinazioni`);
    }
  }

  const hintedSurfaces = new Set(hints.map((h) => normalizeSurface(h.surface)));
  const mappings = collectMappingsFromUseCases(useCases);
  let missingHint = 0;
  for (const m of mappings) {
    const surface = normalizeSurface(m.surface);
    if (!surface || isUnclassifiedSlotId(m.slot_id)) continue;
    if (!SEND_SLOT_IDS.has(m.slot_id)) continue;
    if (hintedSurfaces.has(surface)) continue;
    if (allowlist.size === 0) continue;
    missingHint += 1;
  }
  if (missingHint > 0) {
    reasons.push(`${missingHint} surface data/orario senza hint SEND (Compila o mappa path)`);
  }

  if (reasons.length === 0) return { status: 'valid', reasons: [] };
  return { status: 'invalid', reasons };
}
