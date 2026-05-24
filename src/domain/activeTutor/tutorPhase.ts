/**
 * Active Tutor — fasi ufficiali del Construction Wizard (7 step reali).
 * Indice allineato a `AgentWizardStepIndex` (0..6).
 */

import type { AgentWizardStepIndex } from '@domain/aiAgentConstruction/agentConstructionPhase';

/** Identificatore fase tutor (= step wizard). */
export type TutorPhaseId = AgentWizardStepIndex;

export const TUTOR_PHASE_ORDER: readonly TutorPhaseId[] = [0, 1, 2, 3, 4, 5, 6] as const;

export const TUTOR_PHASE_LABELS: Readonly<Record<TutorPhaseId, string>> = {
  0: 'Task',
  1: 'Knowledge Base',
  2: 'Backend',
  3: 'Prompts',
  4: 'Error Handling',
  5: 'Dati',
  6: 'Voce',
};

/** Sotto-viste opzionali sul passo Backend (nessuna macchina a stati separata). */
export type TutorBackendSubView = 'main' | 'knowledgeBase' | 'interface';

export function isTutorPhaseId(value: unknown): value is TutorPhaseId {
  return (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === 6
  );
}
