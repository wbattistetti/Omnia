/**
 * Provider catalogo LLM designer (Omnia Tutor + portale review): stessa lista in entrambe le UI.
 */

import type { AIProvider } from '@context/AIProviderContext';
import type { LlmCatalogProviderId } from '@services/iaCatalogApi';
import type { AvailableLlmProviderSpec } from '@hooks/useAvailableLlmModels';

/** Provider esposti nel selettore modello designer. */
export const DESIGNER_LLM_PROVIDERS: ReadonlyArray<
  AvailableLlmProviderSpec & { contextProvider: AIProvider }
> = [
  { id: 'groq', displayLabel: 'Groq', contextProvider: 'groq' },
  { id: 'openai', displayLabel: 'OpenAI', contextProvider: 'openai' },
];

export function designerLlmContextProvider(
  catalogProvider: LlmCatalogProviderId
): AIProvider | null {
  const match = DESIGNER_LLM_PROVIDERS.find((p) => p.id === catalogProvider);
  return match ? match.contextProvider : null;
}

export function designerLlmProviderSpecs(): ReadonlyArray<AvailableLlmProviderSpec> {
  return DESIGNER_LLM_PROVIDERS.map(({ id, displayLabel }) => ({ id, displayLabel }));
}
