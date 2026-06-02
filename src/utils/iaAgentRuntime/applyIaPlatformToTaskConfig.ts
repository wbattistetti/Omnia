/**
 * Merges task IA runtime config when the designer picks a platform (ConvAI sync dialog, setup).
 */

import type { IAAgentConfig, IAAgentPlatform } from 'types/iaAgentRuntimeSetup';
import { getDefaultConfig } from './platformHelpers';

/** Applies platform defaults while preserving ConvAI ids and voice when already set. */
export function applyIaPlatformToTaskConfig(
  current: IAAgentConfig,
  platform: IAAgentPlatform
): IAAgentConfig {
  const defaults = getDefaultConfig(platform);
  if (platform !== 'elevenlabs') {
    return {
      ...defaults,
      platform,
      tools: current.tools?.length ? current.tools : defaults.tools,
      convaiBackendToolTaskIds:
        current.convaiBackendToolTaskIds?.length
          ? current.convaiBackendToolTaskIds
          : defaults.convaiBackendToolTaskIds,
    };
  }

  const voiceOk = Boolean(current.voice?.id?.trim());
  const voicesOk = Boolean(current.voices?.some((v) => v.id?.trim()));

  return {
    ...defaults,
    ...current,
    platform: 'elevenlabs',
    model: defaults.model,
    convaiAgentId: current.convaiAgentId?.trim() || defaults.convaiAgentId,
    convaiBackendToolTaskIds:
      current.convaiBackendToolTaskIds?.length
        ? current.convaiBackendToolTaskIds
        : defaults.convaiBackendToolTaskIds,
    ttsModel: current.ttsModel?.trim() ? current.ttsModel : defaults.ttsModel,
    voice: voiceOk ? current.voice : defaults.voice,
    voices: voicesOk ? current.voices : defaults.voices,
    advanced: {
      ...(defaults.advanced ?? {}),
      ...(current.advanced ?? {}),
      llm: {
        ...((defaults.advanced?.llm as object) ?? {}),
        ...((current.advanced?.llm as object) ?? {}),
      },
    },
  };
}
