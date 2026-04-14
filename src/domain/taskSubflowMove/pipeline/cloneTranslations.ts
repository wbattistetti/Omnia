/**
 * Canonical step: copy parent flow-local translation entries into child slice.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { cloneTranslationsToChild } from '../taskMoveTranslationPipeline';

export type CloneTranslationsInput = {
  flows: WorkspaceState['flows'];
  parentFlowId: string;
  childFlowId: string;
  logicalKeys: ReadonlySet<string>;
};

export type CloneTranslationsOutput = WorkspaceState['flows'];

export function CloneTranslations(input: CloneTranslationsInput): CloneTranslationsOutput {
  return cloneTranslationsToChild(input.flows, input.parentFlowId, input.childFlowId, input.logicalKeys);
}
