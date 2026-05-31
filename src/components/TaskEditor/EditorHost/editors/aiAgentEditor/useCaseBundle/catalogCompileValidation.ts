/**
 * Validazione unificata compile catalogo: lessico slot + binding backend output.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { ProjectSlotLexicon } from '@domain/useCaseBundle/projectSlotLexicon';
import type { AgentBackendOutputSlotBindings } from '@domain/backendOutputSlotBinding/types';
import {
  formatCompileMappingBanner,
  validateBackendOutputBindings,
} from '@domain/backendOutputSlotBinding/validateBackendOutputBindings';
import { validateSendHints } from '@domain/backendOutputSlotBinding/validateSendHints';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import type { BackendSendLeavesGroup } from '@domain/backendOutputSlotBinding/collectBackendSendLeavesByTask';
import { computeSlotMappingValidation } from './slotMappingValidation';

export type CatalogCompileValidationStatus = 'valid' | 'invalid';

export interface CatalogCompileValidationResult {
  status: CatalogCompileValidationStatus;
  slotReasons: string[];
  backendReasons: string[];
  bannerMessage: string;
}

export function computeCatalogCompileValidation(
  lexicon: ProjectSlotLexicon,
  useCases: readonly AIAgentUseCase[],
  bindings: AgentBackendOutputSlotBindings,
  backendLinked: boolean,
  options?: {
    sendLeaves?: readonly BackendSendParamLeaf[];
    backendGroups?: readonly BackendSendLeavesGroup[];
  }
): CatalogCompileValidationResult {
  const slot = computeSlotMappingValidation(lexicon, useCases);
  const backend = validateBackendOutputBindings(useCases, bindings, backendLinked);
  const send = validateSendHints(
    useCases,
    bindings,
    options?.sendLeaves ?? [],
    backendLinked,
    { backendGroups: options?.backendGroups }
  );

  const slotReasons = slot.status === 'invalid' ? [...slot.reasons] : [];
  const backendReasons = [
    ...(backend.status === 'invalid' ? backend.reasons : []),
    ...(send.status === 'invalid' ? send.reasons : []),
  ];

  const status: CatalogCompileValidationStatus =
    slotReasons.length === 0 && backendReasons.length === 0 ? 'valid' : 'invalid';

  return {
    status,
    slotReasons,
    backendReasons,
    bannerMessage: formatCompileMappingBanner(slotReasons, backendReasons),
  };
}
