/**
 * Ordered wizard steps and limits (typed registry; copy lives in config).
 */

import type { UseCaseGeneratorWizardStepId } from './types';

export const USE_CASE_GENERATOR_WIZARD_STEP_ORDER: readonly UseCaseGeneratorWizardStepId[] = [
  'use_case_list',
  'example_phrases',
  'conversations',
  'tokenization',
  'json_generation',
] as const;

export const USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS = 5;

export function wizardStepIndexOf(id: UseCaseGeneratorWizardStepId): number {
  const i = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.indexOf(id);
  if (i < 0) throw new Error(`Unknown wizard step: ${id}`);
  return i;
}
