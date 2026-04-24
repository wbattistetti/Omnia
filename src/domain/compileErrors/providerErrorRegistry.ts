/**
 * Ordered list of provider adapters for {@link normalizeProviderError}.
 */

import { elevenLabsErrorAdapter } from './elevenLabsErrorAdapter';

export const providerErrorAdapters = [
  elevenLabsErrorAdapter,
  // openAiErrorAdapter,
  // anthropicErrorAdapter,
  // geminiErrorAdapter,
  // customProviderErrorAdapter,
];
