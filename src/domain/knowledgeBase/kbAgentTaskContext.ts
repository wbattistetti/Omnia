/**
 * Build agent task context payload for KB document analysis API calls.
 */

import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

export type KbTaskVariableWire = {
  slotId: string;
  label: string;
  internalName: string;
};

export function buildKbAgentTaskSummary(
  designDescription: string,
  composedRuntimeMarkdown?: string
): string {
  const desc = String(designDescription || '').trim();
  const runtime = String(composedRuntimeMarkdown || '').trim();
  if (!desc && !runtime) return '';
  if (!runtime) return desc;
  if (!desc) return runtime.slice(0, 12_000);
  return `${desc}\n\n---\n\n${runtime}`.trim().slice(0, 16_000);
}

export function buildKbTaskVariablesWire(
  proposedFields: readonly AIAgentProposedVariable[]
): KbTaskVariableWire[] {
  return proposedFields.map((f) => ({
    slotId: String(f.slotId || '').trim(),
    label: String(f.label || '').trim(),
    internalName: String(f.internalName || '').trim(),
  }));
}

export function buildKbExistingUseCaseSummaries(
  useCases: readonly AIAgentUseCase[]
): string[] {
  return useCases
    .map((uc) => {
      const label = String(uc.label || '').trim();
      const payoff = String(uc.payoff || uc.scenario?.descrittivo || '').trim();
      if (!label) return '';
      return payoff ? `${label}: ${payoff.slice(0, 120)}` : label;
    })
    .filter(Boolean)
    .slice(0, 24);
}
