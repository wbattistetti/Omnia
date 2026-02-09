/**
 * Enum unico per lo stato del wizard.
 * Sostituisce currentStep + showStructureConfirmation + structureConfirmed + showCorrectionMode
 * con un unico stato chiaro e mutuamente esclusivo.
 */
export enum WizardMode {
  // Wizard appena aperto, deve partire automaticamente con taskLabel
  START = 'start',

  // Struttura dati generata, in attesa conferma utente (sidebar visibile con Sì/No)
  DATA_STRUCTURE_PROPOSED = 'data_structure_proposed',

  // Struttura confermata, procede con generazione constraints/parser/messages
  DATA_STRUCTURE_CONFIRMED = 'data_structure_confirmed',

  // Modalità correzione struttura (utente ha cliccato "No")
  DATA_STRUCTURE_CORRECTION = 'data_structure_correction',

  // In generazione parallela (constraints, parser, messages)
  GENERATING = 'generating',

  // Task completato
  COMPLETED = 'completed',

  // Stati speciali (euristica, lista moduli, ecc.)
  EURISTICA_TROVATA = 'euristica_trovata',
  EURISTICA_NON_TROVATA = 'euristica_non_trovata',
  LISTA_MODULI = 'lista_moduli',
}

export type WizardModeType = WizardMode | `${WizardMode}`;
