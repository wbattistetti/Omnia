/**
 * Canonical serialization of use-case list for wizard dirty detection vs last IA snapshot.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';

function assistantContent(uc: AIAgentUseCase): string {
  const a = uc.dialogue.find((t) => t.role === 'assistant');
  return a?.content ?? '';
}

/**
 * Stable JSON string for comparing designer edits to the last IA-generated bundle.
 * Includes structure (ids, hierarchy, order) and payoff + first assistant line (scenario line for UX).
 */
export function serializeUseCaseListForWizardBaseline(useCases: readonly AIAgentUseCase[]): string {
  const sorted = [...useCases].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.id.localeCompare(b.id);
  });
  return JSON.stringify(
    sorted.map((u) => ({
      id: u.id,
      label: u.label,
      parent_id: u.parent_id,
      sort_order: u.sort_order,
      payoff: u.payoff ?? '',
      assistant: assistantContent(u),
    }))
  );
}
