/**
 * Static copy for the use-case generator wizard (instructions, tutorials, confirm prompts).
 * Struttura elegante riusabile: panelHeading + lead + elenco puntato nel pannello DX.
 */

import type { UseCaseGeneratorWizardStepId } from './types';

export interface UseCaseGeneratorWizardStepConfig {
  id: UseCaseGeneratorWizardStepId;
  /** Titolo breve: pill nella toolbar e header DX (deve combaciare con la stazione in alto). */
  title: string;
  /**
   * Titolo del tutorial DX (renderizzato come pill nelle review-card del passo).
   * NB: niente più prefisso «Passo N°: » — la posizione nella pipeline è già visibile
   * nello stepper sopra; ripeterla nel tutorial sarebbe ridondante.
   */
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
    title: 'Casi d’uso',
    panelHeading: 'Creazione dei casi d’uso',
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
    confirmNoEditsMessage: 'Non hai fatto correzioni. Vuoi proseguire comunque?',
  },
  {
    id: 'conversations',
    title: 'Conversazioni',
    panelHeading: 'Conversazioni',
    /** Il copy concreto è renderizzato dal pannello DX, che varia in base al numero di conversazioni. */
    instructionLead: '',
    instructionBullets: [],
    instructionPlain: '',
    tutorialIfNoChanges:
      'La revisione delle conversazioni è fondamentale per garantire che il flusso dialogico sia naturale e coerente.',
    confirmNoEditsMessage:
      'Nessuna modifica registrata rispetto all’ultima generazione IA delle conversazioni. Vuoi proseguire?',
  },
  {
    id: 'tokenization',
    title: 'Prompt e JSON',
    panelHeading: 'Compilazione prompt e JSON',
    instructionLead:
      'Il sistema compila automaticamente le frasi canoniche in template runtime e JSON. Puoi:',
    instructionBullets: [
      'verificare il testo naturale con valori tra quadre',
      'controllare il template runtime derivato',
      'copiare il prompt conversazionale finale',
    ],
    instructionPlain:
      'Il JSON è una vista read-only derivata dagli use case: se qualcosa non torna, correggi il messaggio agente canonico.',
    tutorialIfNoChanges:
      'Controlla il nastro di compilazione: testo naturale, token runtime e JSON devono rappresentare la stessa frase.',
    confirmNoEditsMessage:
      'Non hai corretto i messaggi canonici. Vuoi concludere comunque?',
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
