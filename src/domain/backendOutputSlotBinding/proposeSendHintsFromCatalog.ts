/**
 * Dopo compile catalogo: propone hint SEND deterministici da surface nei messaggi.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import { collectMappingsFromUseCases } from '@domain/useCaseBundle/semanticCompile';
import type { BackendSendParamLeaf } from '@domain/openApi/backendSendParamCatalog';
import type { AgentBackendOutputSlotBindings } from './types';
import { mergeSendHintsIntoBindings } from './mergeSendHints';
import type { BackendSendLeavesGroup } from './collectBackendSendLeavesByTask';
import {
  buildParameterDestinationCatalog,
  proposeSendHintFromDestinationCatalog,
} from './parameterDestinationTree';

export function proposeAndMergeSendHintsFromCatalog(
  bindings: AgentBackendOutputSlotBindings,
  useCases: readonly AIAgentUseCase[],
  leaves: readonly BackendSendParamLeaf[],
  options: { backendGroups: readonly BackendSendLeavesGroup[] }
): AgentBackendOutputSlotBindings {
  if (leaves.length === 0 || options.backendGroups.length === 0) return bindings;
  const catalog = buildParameterDestinationCatalog(options.backendGroups);
  const mappings = collectMappingsFromUseCases(useCases);
  const proposed = [];
  const seen = new Set<string>();
  for (const m of mappings) {
    const key = m.surface.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const hint = proposeSendHintFromDestinationCatalog(m.surface, m.slot_id, catalog);
    if (hint) proposed.push(hint);
  }
  if (proposed.length === 0) return bindings;
  return mergeSendHintsIntoBindings(bindings, proposed, leaves);
}
