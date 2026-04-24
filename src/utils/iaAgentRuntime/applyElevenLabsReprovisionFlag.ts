import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';

/**
 * Dopo cambio `ttsModel` con ConvAI già associato (`convaiAgentId`), marca `elevenLabsNeedsReprovision`
 * così `ensureConvaiAgentsProvisioned` riesegue `createAgent` con `conversation_config` (incluso TTS).
 */
export function withElevenLabsReprovisionAfterTtsChange(
  prev: IAAgentConfig,
  merged: IAAgentConfig,
  editorHydrated: boolean
): IAAgentConfig {
  const prevTts = String(prev.ttsModel ?? '').trim();
  const newTts = String(merged.ttsModel ?? '').trim();
  const ttsChanged = prevTts !== newTts;
  const hasAgent = Boolean(merged.convaiAgentId?.trim());
  let elevenLabsNeedsReprovision = merged.elevenLabsNeedsReprovision === true;
  if (editorHydrated && merged.platform === 'elevenlabs' && hasAgent && ttsChanged) {
    elevenLabsNeedsReprovision = true;
  }
  if (merged.platform !== 'elevenlabs' || !hasAgent) {
    elevenLabsNeedsReprovision = false;
  }
  return { ...merged, elevenLabsNeedsReprovision };
}
