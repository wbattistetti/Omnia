/**
 * Ordered wizard steps and limits (typed registry; copy lives in config).
 */

import type { UseCaseGeneratorWizardStepId } from './types';

export const USE_CASE_GENERATOR_WIZARD_STEP_ORDER: readonly UseCaseGeneratorWizardStepId[] = [
  'use_case_list',
  'conversations',
  'tokenization',
] as const;

/**
 * Limite hard di conversazioni montate dall'AI per task. Oltre questo numero il pannello
 * smette di generare e i pulsanti contestuali nel pannello DX vengono inibiti.
 * Tipicamente la review è satura intorno a 4–5 conversazioni (2 positive + 2 negative + 1
 * con use case emergenti, o equivalente). Il batch per singolo click è dinamico: vedi
 * `runAssembleConversation` in `AIAgentEditor.tsx`.
 */
export const USE_CASE_GENERATOR_WIZARD_MAX_CONVERSATIONS = 5;

export function wizardStepIndexOf(id: UseCaseGeneratorWizardStepId): number {
  const i = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.indexOf(id);
  if (i < 0) throw new Error(`Unknown wizard step: ${id}`);
  return i;
}
