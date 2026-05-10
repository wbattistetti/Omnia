/**
 * Static copy for the use-case generator wizard (instructions, tutorials, confirm prompts).
 * Struttura elegante riusabile: panelHeading + lead + elenco puntato nel pannello DX.
 */

import type { UseCaseGeneratorWizardStepId } from './types';

export interface UseCaseGeneratorWizardStepConfig {
  id: UseCaseGeneratorWizardStepId;
  /** Titolo breve: pill nella toolbar e header DX (deve combaciare con la stazione in alto). */
  title: string;
  /** Titolo esteso nel corpo del tutorial DX (es. «Passo 1°: …»). */
  panelHeading: string;
  /** Incipit sotto il titolo esteso. */
  instructionLead: string;
  /** Elenco puntato attività del designer; vuoto = si usa solo instructionPlain. */
  instructionBullets: readonly string[];
  /** Paragrafo unico se bullets vuoti o come supplemento legacy. */
  instructionPlain: string;
  tutorialIfNoChanges: string;
  confirmNoEditsMessage: string;
}

export const USE_CASE_GENERATOR_WIZARD_STEPS: readonly UseCaseGeneratorWizardStepConfig[] = [
  {
    id: 'use_case_list',
    title: 'Crea casi d’uso',
    panelHeading: 'Passo 1°: Creazione dei casi d’uso per il task',
    instructionLead:
      'Iniziamo generando automaticamente i casi d’uso più frequenti.\n\n' +
      'Il tuo compito sarà quello di controllare la lista proposta. Potrai:',
    instructionBullets: [
      'correggere le etichette che ho assegnato',
      'rivedere gli scenari descritti',
      'aggiungere manualmente nuovi casi d’uso',
      'eliminare quelli che non ti sembrano appropriati',
    ],
    instructionPlain: '',
    tutorialIfNoChanges:
      'Ho visto che non hai fatto modifiche. Vanno bene, quindi?',
    confirmNoEditsMessage:
      'Non risultano modifiche rispetto all’ultima generazione IA della lista use case. Vuoi proseguire comunque?',
  },
  {
    id: 'example_phrases',
    title: 'Frasi di esempio',
    panelHeading: 'Passo 2°: Frasi di esempio e stile',
    instructionLead:
      'Definisci le prime frasi (al massimo quattro o il numero di use case, se inferiore) per ancorare tono e stile.',
    instructionBullets: [
      'adeguare le frasi al registro desiderato',
      'correggere dettagli prima dell’estensione agli altri casi',
      'confermare lo stile prima di proseguire',
    ],
    instructionPlain:
      'Integrazione pipeline (generazione batch e affinamento) in preparazione; usa Avanti quando hai verificato questo passo.',
    tutorialIfNoChanges:
      'Correggere le frasi iniziali è importante per definire lo stile dell’agente. ' +
      'Senza questa fase, le frasi generate potrebbero non rispecchiare il tono desiderato.',
    confirmNoEditsMessage:
      'Nessuna modifica registrata rispetto all’ultima generazione IA per le frasi di esempio. Vuoi proseguire?',
  },
  {
    id: 'conversations',
    title: 'Conversazioni',
    panelHeading: 'Passo 3°: Montaggio conversazioni multi–use case',
    instructionLead:
      'Verifica come le frasi si concatenano in dialoghi realistici tra più casi d’uso.',
    instructionBullets: [
      'controllare la fluidità tra turni',
      'correggere incoerenze tra bubble',
      'mantenere il riferimento al caso d’uso mostrato',
    ],
    instructionPlain:
      'Schema dati: conversationId e turns (user | agent + useCaseId). Integrazione pipeline in preparazione.',
    tutorialIfNoChanges:
      'La revisione delle conversazioni è fondamentale per garantire che il flusso dialogico sia naturale e coerente.',
    confirmNoEditsMessage:
      'Nessuna modifica registrata rispetto all’ultima generazione IA delle conversazioni. Vuoi proseguire?',
  },
  {
    id: 'tokenization',
    title: 'Tokenizzazione',
    panelHeading: 'Passo 4°: Tokenizzazione delle frasi',
    instructionLead:
      'Trasforma le frasi in schemi con slot tra parentesi quadre (es. [data], [ora]).',
    instructionBullets: [
      'verificare che ogni slot abbia un nome chiaro',
      'correggere segmenti lasciati come testo fisso se serve',
      'allineare i placeholder al dominio del task',
    ],
    instructionPlain:
      'Dopo l’IA applicheremo validazione deterministica. Integrazione completa in preparazione.',
    tutorialIfNoChanges:
      'La tokenizzazione è fondamentale per generalizzare le frasi. ' +
      'Senza correzioni manuali, rischi che i placeholder non siano precisi.',
    confirmNoEditsMessage:
      'Nessuna modifica registrata rispetto all’ultima tokenizzazione IA. Vuoi proseguire?',
  },
  {
    id: 'json_generation',
    title: 'JSON / System prompt',
    panelHeading: 'Passo 5°: JSON motore e system prompt',
    instructionLead:
      'Per ogni caso d’uso il sistema produce JSON allineato al runtime Omnia (virtual catalog / motor).',
    instructionBullets: [
      'controllare intent, costanti e slot rispetto al task',
      'correggere incoerenze prima dell’esportazione',
      'generare il system prompt finale quando tutto è validato',
    ],
    instructionPlain:
      'Usa gli strumenti «Crea JSON» nel composer dove disponibili; integrazione wizard in preparazione.',
    tutorialIfNoChanges:
      'La revisione dei JSON è importante per garantire che l’agente risponda in modo deterministico e coerente.',
    confirmNoEditsMessage:
      'Nessuna modifica registrata rispetto all’ultima generazione IA dei JSON. Vuoi proseguire?',
  },
];

const BY_ID = new Map<UseCaseGeneratorWizardStepId, UseCaseGeneratorWizardStepConfig>(
  USE_CASE_GENERATOR_WIZARD_STEPS.map((s) => [s.id, s])
);

export function getUseCaseGeneratorWizardStepConfig(
  id: UseCaseGeneratorWizardStepId
): UseCaseGeneratorWizardStepConfig {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Missing wizard config for step ${id}`);
  return c;
}
