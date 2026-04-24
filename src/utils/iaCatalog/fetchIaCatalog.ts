/**
 * Loads IA catalog slices for the selected runtime platform — one provider per dropdown.
 */

import type { CatalogLanguage, CatalogModel, CatalogVoice } from '@services/iaCatalogApi';
import {
  fetchCatalogLanguages,
  fetchCatalogModels,
  fetchCatalogVoices,
  type VoiceCatalogQueryParams,
} from '@services/iaCatalogApi';

/** Piattaforma runtime IA (allineata a {@link import('types/iaAgentRuntimeSetup').IAAgentPlatform}). */
export type IaRuntimeCatalogPlatform =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'elevenlabs'
  | 'custom';

export async function fetchIaModelsForPlatform(
  platform: IaRuntimeCatalogPlatform,
  q?: string
): Promise<CatalogModel[]> {
  switch (platform) {
    case 'openai':
    case 'anthropic':
    case 'google':
    case 'elevenlabs':
      return fetchCatalogModels(platform, q);
    case 'custom':
      return [];
    default:
      return [];
  }
}

export async function fetchIaVoicesForPlatform(
  platform: IaRuntimeCatalogPlatform,
  params?: VoiceCatalogQueryParams
): Promise<{ voices: CatalogVoice[]; applicable: boolean; message?: string }> {
  if (platform !== 'elevenlabs') {
    return { voices: [], applicable: false, message: undefined };
  }
  return fetchCatalogVoices('elevenlabs', params);
}

export async function fetchIaLanguagesForPlatform(
  platform: IaRuntimeCatalogPlatform,
  q?: string
): Promise<{ languages: CatalogLanguage[]; applicable: boolean; message?: string }> {
  if (platform !== 'elevenlabs') {
    return { languages: [], applicable: false };
  }
  return fetchCatalogLanguages('elevenlabs', q);
}
