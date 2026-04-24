/**
 * IA runtime catalog helpers: load models/voices/languages per selected platform.
 */

export type { IaRuntimeCatalogPlatform } from './fetchIaCatalog';
export {
  fetchIaLanguagesForPlatform,
  fetchIaModelsForPlatform,
  fetchIaVoicesForPlatform,
} from './fetchIaCatalog';
export type { IaCatalogSliceLoaders } from './iaCatalogProviders';
export { getIaCatalogLoaders } from './iaCatalogProviders';
