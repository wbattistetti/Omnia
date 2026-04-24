/**
 * Provider-aware catalog loaders (facade over {@link fetchIaCatalog.ts}).
 * Extend with custom adapters when adding new IA backends.
 */

import type { CatalogLanguage, CatalogModel, CatalogVoice } from '@services/iaCatalogApi';
import type { VoiceCatalogQueryParams } from '@services/iaCatalogApi';
import type { IaRuntimeCatalogPlatform } from './fetchIaCatalog';
import {
  fetchIaLanguagesForPlatform,
  fetchIaModelsForPlatform,
  fetchIaVoicesForPlatform,
} from './fetchIaCatalog';

export interface IaCatalogSliceLoaders {
  fetchModels(q?: string): Promise<CatalogModel[]>;
  fetchVoices?(params?: VoiceCatalogQueryParams): Promise<{
    voices: CatalogVoice[];
    applicable: boolean;
    message?: string;
  }>;
  fetchLanguages?(q?: string): Promise<{
    languages: CatalogLanguage[];
    applicable: boolean;
    message?: string;
  }>;
}

export function getIaCatalogLoaders(platform: IaRuntimeCatalogPlatform): IaCatalogSliceLoaders {
  return {
    fetchModels: (q?: string) => fetchIaModelsForPlatform(platform, q),
    fetchVoices: (params?: VoiceCatalogQueryParams) => fetchIaVoicesForPlatform(platform, params),
    fetchLanguages: (q?: string) => fetchIaLanguagesForPlatform(platform, q),
  };
}
