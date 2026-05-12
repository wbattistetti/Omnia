/**
 * Stili condivisi delle review-card del wizard use case (Passo 1/2/3 → pannello DX).
 *
 * `wizardTutorialHeadingPill(theme)`: pill colorata coerente con lo stepper, usata come
 * heading di tutte le tutorial card. Il prefisso «Passo N°» NON va più dentro al testo:
 * la posizione nella pipeline è già visibile nello stepper sopra.
 */

import type { UseCaseGeneratorWizardStepId } from '@domain/useCaseGeneratorWizard/types';

const PILL_BASE =
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

/**
 * Mappa step → classi Tailwind per la pill heading. Mantiene la stessa palette del
 * `STEP_COLOR_THEME` di `ViewSkaGenerator` per associazione visiva immediata
 * (viola = Casi d'uso, teal = Conversazioni, amber = Tokenizzazione).
 */
const PILL_BY_STEP: Record<UseCaseGeneratorWizardStepId, string> = {
  use_case_list: 'border-violet-400/55 bg-violet-950/55 text-amber-100',
  conversations: 'border-teal-400/55 bg-teal-950/45 text-emerald-50',
  tokenization: 'border-amber-400/55 bg-amber-950/45 text-amber-50',
};

export function wizardTutorialHeadingPill(stepId: UseCaseGeneratorWizardStepId): string {
  return `${PILL_BASE} ${PILL_BY_STEP[stepId]}`;
}
