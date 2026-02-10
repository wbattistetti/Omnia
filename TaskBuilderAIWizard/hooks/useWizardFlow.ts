// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { WizardMode } from '../types/WizardMode';

/**
 * Hook che gestisce SOLO le transizioni di stato del wizard.
 * Funzioni pure che cambiano wizardMode.
 * Nessuna API, nessuna pipeline, nessuna sincronizzazione, nessun effetto.
 */
export function useWizardFlow(
  wizardMode: WizardMode,
  setWizardMode: (mode: WizardMode) => void
) {
  // ============================================
  // TRANSIZIONI DI STATO - Funzioni pure
  // ============================================

  /**
   * START → DATA_STRUCTURE_PROPOSED
   * Dopo la generazione della struttura dati
   */
  const transitionToProposed = useCallback(() => {
    if (wizardMode === WizardMode.START) {
      setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
    }
  }, [wizardMode, setWizardMode]);

  /**
   * DATA_STRUCTURE_PROPOSED → DATA_STRUCTURE_CONFIRMED
   * Quando l'utente conferma la struttura (opzionale, può essere saltato)
   */
  const transitionToConfirmed = useCallback(() => {
    if (wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED) {
      setWizardMode(WizardMode.DATA_STRUCTURE_CONFIRMED);
    }
  }, [wizardMode, setWizardMode]);

  /**
   * DATA_STRUCTURE_PROPOSED → DATA_STRUCTURE_CORRECTION
   * Quando l'utente rifiuta la struttura
   */
  const transitionToCorrection = useCallback(() => {
    if (wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED) {
      setWizardMode(WizardMode.DATA_STRUCTURE_CORRECTION);
    }
  }, [wizardMode, setWizardMode]);

  /**
   * DATA_STRUCTURE_CORRECTION → DATA_STRUCTURE_PROPOSED
   * Quando l'utente torna indietro dalla correzione
   */
  const transitionFromCorrection = useCallback(() => {
    if (wizardMode === WizardMode.DATA_STRUCTURE_CORRECTION) {
      setWizardMode(WizardMode.DATA_STRUCTURE_PROPOSED);
    }
  }, [wizardMode, setWizardMode]);

  /**
   * DATA_STRUCTURE_CONFIRMED → GENERATING
   * Dopo la conferma, inizia la generazione parallela
   */
  const transitionToGenerating = useCallback(() => {
    if (wizardMode === WizardMode.DATA_STRUCTURE_CONFIRMED ||
        wizardMode === WizardMode.DATA_STRUCTURE_PROPOSED) {
      setWizardMode(WizardMode.GENERATING);
    }
  }, [wizardMode, setWizardMode]);

  /**
   * GENERATING → COMPLETED
   * Quando tutti gli step della pipeline sono completati
   */
  const transitionToCompleted = useCallback(() => {
    if (wizardMode === WizardMode.GENERATING) {
      setWizardMode(WizardMode.COMPLETED);
    }
  }, [wizardMode, setWizardMode]);

  /**
   * Reset a START
   * Per riavviare il wizard
   */
  const resetToStart = useCallback(() => {
    setWizardMode(WizardMode.START);
  }, [setWizardMode]);

  return {
    transitionToProposed,
    transitionToConfirmed,
    transitionToCorrection,
    transitionFromCorrection,
    transitionToGenerating,
    transitionToCompleted,
    resetToStart,
  };
}
