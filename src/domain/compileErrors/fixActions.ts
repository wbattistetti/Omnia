/**
 * Maps normalized IA provider errors to Fix navigation (IA Runtime focus).
 */

import type { IaRuntimeFocus } from '@components/FlowCompiler/types';
import type { NormalizedIaProviderError } from './iaProviderErrors';
import { providerErrorAdapters } from './providerErrorRegistry';

export type ProviderFixActionId =
  | 'open_elevenlabs_language'
  | 'open_elevenlabs_model'
  | 'open_elevenlabs_voice'
  | 'open_elevenlabs_panel'
  | 'open_provider_panel';

export function inferFixAction(err: NormalizedIaProviderError): ProviderFixActionId {
  const adapter = providerErrorAdapters.find((a) => a.provider === err.provider);
  const id = adapter?.inferFixAction?.(err);
  if (typeof id === 'string' && id.length > 0) return id as ProviderFixActionId;
  return 'open_provider_panel';
}

export function providerFixActionToIaRuntimeFocus(action: ProviderFixActionId): IaRuntimeFocus {
  switch (action) {
    case 'open_elevenlabs_language':
      return 'language';
    case 'open_elevenlabs_model':
      return 'llm';
    case 'open_elevenlabs_voice':
      return 'voice';
    case 'open_elevenlabs_panel':
      return 'agentId';
    case 'open_provider_panel':
    default:
      return 'catalog';
  }
}
