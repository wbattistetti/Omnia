/**
 * Active Tutor — messaggi introduttivi fissi per ogni tab (7 fasi).
 */

import type { TutorPhaseKey } from './tutorPhaseKey';

export const TUTOR_PHASE_INTRO: Readonly<Record<TutorPhaseKey, string>> = {
  task: 'Qui definisci l’obiettivo, il dominio, i limiti e il tono del tuo agente.',
  knowledgeBase: 'Qui carichi documenti e arricchisci la conoscenza dell’agente.',
  backend: 'Qui definisci le azioni API che l’agente può chiamare.',
  prompts: 'Qui generi use case, conversazioni e stile conversazionale.',
  errorHandling: 'Qui definisci regole conversazionali trasversali (error handling).',
  dati: 'Qui rivedi i dati strutturati inferiti per l’agente.',
  voce: 'Qui definisci la voce e il comportamento vocale dell’agente.',
};

export const TUTOR_INCOMPLETE_PHASE_WARNING =
  'Questa fase non è ancora completa, ma posso comunque spiegartela e rispondere alle tue domande.';

export const TASK_DESCRIPTION_MIN_CHARS = 40;

export const TASK_GUIDANCE_EMPTY =
  'Inizia descrivendo cosa deve fare il tuo agente.';

export const TASK_GUIDANCE_FILLED =
  "Hai già una descrizione. Possiamo raffinarla insieme usando 'Create Agent'.";
