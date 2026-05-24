/**
 * Active Tutor — chiavi conversazione tab ↔ indice wizard (7 fasi).
 */

import type { TutorPhaseId } from './tutorPhase';

export type TutorPhaseKey =
  | 'task'
  | 'knowledgeBase'
  | 'backend'
  | 'prompts'
  | 'errorHandling'
  | 'dati'
  | 'voce';

export const TUTOR_PHASE_KEYS: readonly TutorPhaseKey[] = [
  'task',
  'knowledgeBase',
  'backend',
  'prompts',
  'errorHandling',
  'dati',
  'voce',
] as const;

const INDEX_TO_KEY: readonly TutorPhaseKey[] = TUTOR_PHASE_KEYS;

const KEY_TO_INDEX: Readonly<Record<TutorPhaseKey, TutorPhaseId>> = {
  task: 0,
  knowledgeBase: 1,
  backend: 2,
  prompts: 3,
  errorHandling: 4,
  dati: 5,
  voce: 6,
};

export function tutorPhaseKeyFromId(phase: TutorPhaseId): TutorPhaseKey {
  return INDEX_TO_KEY[phase] ?? 'task';
}

export function tutorPhaseIdFromKey(key: TutorPhaseKey): TutorPhaseId {
  return KEY_TO_INDEX[key];
}

export function createEmptyConversations(): Record<TutorPhaseKey, never[]> {
  return {
    task: [],
    knowledgeBase: [],
    backend: [],
    prompts: [],
    errorHandling: [],
    dati: [],
    voce: [],
  };
}
