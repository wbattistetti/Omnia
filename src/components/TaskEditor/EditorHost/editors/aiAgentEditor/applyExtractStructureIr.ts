/**
 * Maps Phase-1 structured_design (IR) into editor apply shapes and deterministic runtime_compact.
 */

import type { AIAgentRuntimeCompact } from '@types/aiAgentDesign';
import { seedPreviewByStyleFromSample } from '@types/aiAgentPreview';
import { composeRuntimePromptMarkdown } from './composeRuntimePromptMarkdown';
import type { AgentStructuredSectionId } from './agentStructuredSectionIds';
import { formatOperationalSequenceNewlines } from './operationalSequenceDisplay';
import type { GenerateDesignApplyResult } from './mergeDesignFromApi';

/** JSON IR returned by POST /design/extract-structure (Phase 1). */
export interface AgentStructuredDesignIr {
  goal: string;
  operational_sequence: string;
  context: string;
  constraints: { must: string; must_not: string };
  personality: string;
  tone: string;
}

function clipWords(text: string, maxWords: number): string {
  const w = text.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return '';
  return w.slice(0, maxWords).join(' ');
}

/**
 * Build runtime_compact without LLM (word caps mirror backend design-time contract).
 */
export function buildDeterministicRuntimeCompactFromSectionBases(
  sections: Record<AgentStructuredSectionId, string>
): AIAgentRuntimeCompact {
  const behavior = clipWords(`${sections.personality} ${sections.tone}`.replace(/\s+/g, ' ').trim(), 20);
  const constraints = clipWords((sections.constraints || '').replace(/\s+/g, ' '), 28);
  const sequence = clipWords((sections.operational_sequence || '').replace(/\s+/g, ' '), 32);
  const corrections = clipWords((sections.goal || '').replace(/\s+/g, ' '), 20);
  return {
    behavior_compact: behavior || 'Professional concise agent.',
    constraints_compact: constraints || 'Follow stated must and must-not rules.',
    sequence_compact: sequence || 'Greet clarify confirm assist.',
    corrections_compact: corrections || 'Confirm unclear inputs before acting.',
    examples_compact: [
      { role: 'user', content: clipWords('Ciao', 12) || 'Ciao' },
      { role: 'assistant', content: clipWords('Come posso aiutarti', 12) || 'Come posso aiutarti' },
    ],
  };
}

function constraintsIrToSectionText(c: { must: string; must_not: string }): string {
  const must = String(c?.must ?? '').trim();
  const mustNot = String(c?.must_not ?? '').trim();
  const mLow = must.toLowerCase();
  const nLow = mustNot.toLowerCase();
  const parts: string[] = [];
  if (must && mLow !== 'missing' && mLow !== 'ambiguous') parts.push(`Must: ${must}`);
  if (mustNot && nLow !== 'missing' && nLow !== 'ambiguous') parts.push(`Must not: ${mustNot}`);
  return parts.join('\n');
}

function isStructuredIr(raw: unknown): raw is AgentStructuredDesignIr {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  const c = o.constraints;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const co = c as Record<string, unknown>;
  return (
    typeof o.goal === 'string' &&
    typeof o.operational_sequence === 'string' &&
    typeof o.context === 'string' &&
    typeof o.personality === 'string' &&
    typeof o.tone === 'string' &&
    typeof co.must === 'string' &&
    typeof co.must_not === 'string'
  );
}

/**
 * Turn validated Phase-1 IR into the same editor fragment shape as {@link applyGenerateDesignPayload}.
 */
export function applyStructuredIrToGenerateApplyResult(ir: AgentStructuredDesignIr): GenerateDesignApplyResult {
  const sectionBases: Record<AgentStructuredSectionId, string> = {
    goal: ir.goal.trim(),
    operational_sequence: formatOperationalSequenceNewlines(ir.operational_sequence),
    context: ir.context.trim(),
    constraints: constraintsIrToSectionText(ir.constraints),
    personality: ir.personality.trim(),
    tone: ir.tone.trim(),
    examples: '',
  };
  const agentPrompt = composeRuntimePromptMarkdown(sectionBases);
  const runtime = buildDeterministicRuntimeCompactFromSectionBases(sectionBases);
  return {
    proposedFields: [],
    agentPrompt,
    sectionBases,
    previewByStyle: seedPreviewByStyleFromSample([]),
    initialStateTemplateJson: '{}',
    agentRuntimeCompactJson: JSON.stringify(runtime, null, 2),
    mergeOutputMappings: (previous) => previous,
  };
}

export function parseStructuredDesignIrFromApi(raw: unknown): AgentStructuredDesignIr | null {
  if (!isStructuredIr(raw)) return null;
  return raw;
}
