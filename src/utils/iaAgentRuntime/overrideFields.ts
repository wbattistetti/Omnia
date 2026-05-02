/**
 * Detect which logical sections differ from defaults (for "override" badges in per-task UI).
 */

import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return JSON.stringify(obj.map(stableStringify));
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = (obj as Record<string, unknown>)[k];
  return JSON.stringify(sorted);
}

export interface SectionOverrideFlags {
  modelSection: boolean;
  promptSection: boolean;
  toolsSection: boolean;
  voiceSection: boolean;
  advancedSection: boolean;
}

/**
 * Compare current config to baseline (typically global defaults).
 */
function elevenLabsLlmBlob(c: IAAgentConfig): unknown {
  if (c.platform !== 'elevenlabs') return null;
  const llm = c.advanced?.llm;
  return llm && typeof llm === 'object' ? llm : null;
}

export function computeSectionOverrides(
  value: IAAgentConfig,
  baseline: IAAgentConfig
): SectionOverrideFlags {
  const modelSection =
    value.platform !== baseline.platform ||
    value.model !== baseline.model ||
    value.temperature !== baseline.temperature ||
    value.maxTokens !== baseline.maxTokens ||
    value.reasoning !== baseline.reasoning ||
    stableStringify(elevenLabsLlmBlob(value)) !== stableStringify(elevenLabsLlmBlob(baseline));

  /** systemPrompt is deprecated in setup UI — do not surface override badges for it. */
  const promptSection = false;

  const toolsSection =
    stableStringify(value.tools) !== stableStringify(baseline.tools) ||
    stableStringify(value.convaiBackendToolTaskIds ?? []) !==
      stableStringify(baseline.convaiBackendToolTaskIds ?? []);

  const voiceSection =
    stableStringify(value.voice ?? null) !== stableStringify(baseline.voice ?? null) ||
    stableStringify(value.voices ?? null) !== stableStringify(baseline.voices ?? null) ||
    String(value.ttsModel ?? '').trim() !== String(baseline.ttsModel ?? '').trim();

  const advancedSection =
    stableStringify(value.advanced ?? {}) !== stableStringify(baseline.advanced ?? {});

  return {
    modelSection,
    promptSection,
    toolsSection,
    voiceSection,
    advancedSection,
  };
}
