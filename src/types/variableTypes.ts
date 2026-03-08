// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * SemanticValue: Valore semantico normalizzato con metadata
 */
export interface SemanticValue {
  semantic: any;              // Valore normalizzato usato per decisioni e condizioni
  linguistic?: string;        // Forma linguistica detta dall'utente
  confidence?: number;        // Confidenza dell'interpretazione
  timestamp: number;          // Epoch ms
}

/**
 * Variable: Struttura ricca per ogni variabile di dialogo
 * Ogni variabile corrisponde a un nodo DDT (1:1)
 */
export interface Variable {
  id: string;                 // Identificatore immutabile (GUID), lingua-neutro
  label: string;              // Nome leggibile nella lingua del flow
  value: SemanticValue | null;// Ultimo valore semantico
  values: SemanticValue[];    // Storico dei valori acquisiti (non sovrascritto)
  utterance?: string;         // Ultima frase dell'utente che ha generato il valore
  confirmed: boolean;         // Stato di conferma
}

/**
 * VariableStore: Vista semplificata per valutazione condizioni
 * Usa label come chiave (sicuro perché editor garantisce unicità)
 */
export type VariableStore = Record<string, any>; // { [label: string]: semantic value }
