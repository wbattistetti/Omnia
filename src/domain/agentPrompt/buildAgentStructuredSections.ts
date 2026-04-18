/**
 * Builds {@link AgentStructuredSections} IR from per-section strings and placeholder rows.
 */

import type { AgentStructuredSections, BackendPlaceholderInstance } from './types';

export interface AgentIrSectionTexts {
  goal: string;
  operational_sequence: string;
  context: string;
  constraints: string;
  personality: string;
  tone: string;
  examples?: string;
}

export function buildAgentStructuredSections(
  sections: AgentIrSectionTexts,
  backendPlaceholders: readonly BackendPlaceholderInstance[]
): AgentStructuredSections {
  return {
    goal: sections.goal,
    operational_sequence: sections.operational_sequence,
    context: sections.context,
    constraints: sections.constraints,
    personality: sections.personality,
    tone: sections.tone,
    examples: sections.examples,
    backendPlaceholders: [...backendPlaceholders],
  };
}
