/**
 * Allinea binding SEND (hint) al catalogo UC: prune orfani + proposte deterministiche.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { collectSurfacesInCatalogUseCases } from '@domain/useCaseBundle/semanticCompile';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import type { AgentBackendOutputSlotBindings } from './types';
import { pruneSendHintOrphans } from './pruneSendHintOrphans';
import { proposeAndMergeSendHintsFromCatalog } from './proposeSendHintsFromCatalog';
import type { BackendSendLeavesGroup } from './collectBackendSendLeavesByTask';

export function reconcileSendHintsWithCatalog(
  bindings: AgentBackendOutputSlotBindings,
  useCases: readonly AIAgentUseCase[],
  leaves: readonly BackendSendParamLeaf[],
  options: { backendGroups: readonly BackendSendLeavesGroup[] }
): AgentBackendOutputSlotBindings {
  if (leaves.length === 0) return bindings;

  const surfaces = collectSurfacesInCatalogUseCases(useCases);
  const { bindings: pruned } = pruneSendHintOrphans(bindings, surfaces);

  if (options.backendGroups.length === 0) return pruned;

  return proposeAndMergeSendHintsFromCatalog(pruned, useCases, leaves, {
    backendGroups: options.backendGroups,
  });
}
