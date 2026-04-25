import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

/**
 * Con ConvAI già associato (`convaiAgentId`), marca `elevenLabsNeedsReprovision` se cambiano `ttsModel`
 * o `systemPrompt` (runtime), così `ensureConvaiAgentsProvisioned` riesegue `createAgent`.
 * Le modifiche solo a `agentPrompt` / compact sul task sono gestite in `useAIAgentEditorController`.
 */
export function withElevenLabsReprovisionAfterTtsChange(
  prev: IAAgentConfig,
  merged: IAAgentConfig,
  editorHydrated: boolean
): IAAgentConfig {
  const prevTts = String(prev.ttsModel ?? '').trim();
  const newTts = String(merged.ttsModel ?? '').trim();
  const ttsChanged = prevTts !== newTts;
  const promptChanged = prev.systemPrompt !== merged.systemPrompt;
  const hasAgent = Boolean(merged.convaiAgentId?.trim());
  let elevenLabsNeedsReprovision = merged.elevenLabsNeedsReprovision === true;
  if (editorHydrated && merged.platform === 'elevenlabs' && hasAgent && (ttsChanged || promptChanged)) {
    elevenLabsNeedsReprovision = true;
  }
  if (merged.platform !== 'elevenlabs' || !hasAgent) {
    elevenLabsNeedsReprovision = false;
  }
  return { ...merged, elevenLabsNeedsReprovision };
}
