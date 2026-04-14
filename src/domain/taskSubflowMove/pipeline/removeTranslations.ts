/**
 * Canonical step: remove translation keys from a flow slice (typically parent after clone).
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { removeTranslationKeysFromFlowSlice } from '../taskMoveTranslationPipeline';
import type { TranslationKey } from '../types';

export type RemoveTranslationsInput = {
  flows: WorkspaceState['flows'];
  flowId: string;
  keys: ReadonlySet<TranslationKey>;
};

export type RemoveTranslationsOutput = WorkspaceState['flows'];

export function RemoveTranslations(input: RemoveTranslationsInput): RemoveTranslationsOutput {
  if (input.keys.size === 0) return input.flows;
  return removeTranslationKeysFromFlowSlice(input.flows, input.flowId, input.keys);
}
