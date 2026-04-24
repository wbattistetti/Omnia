/**
 * Maps arbitrary provisioning failures to {@link NormalizedIaProviderError} via adapters.
 */

import type { NormalizedIaProviderError } from './iaProviderErrors';
import { providerErrorAdapters } from './providerErrorRegistry';

export function normalizeProviderError(err: unknown): NormalizedIaProviderError | null {
  for (const adapter of providerErrorAdapters) {
    if (adapter.canHandle(err)) {
      return adapter.normalize(err);
    }
  }
  return null;
}
