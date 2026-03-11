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
 * VariableInstance: Variabile associata a un'istanza di task
 * Ogni variabile ha un varId univoco per evitare collisioni quando lo stesso template è usato in istanze diverse
 */
export interface VariableInstance {
  varId: string;          // GUID univoco per ogni istanza×nodo (NUOVO)
  varName: string;        // Nome leggibile: "data di nascita" | "data di nascita.giorno"
  taskInstanceId: string; // rowId dell'istanza (sempre = task.id)
  nodeId: string;         // GUID del nodo nel template (riferimento struttura)
  ddtPath: string;        // Path nel DDT: "data[0]" | "data[0].subData[1]"
}

/**
 * VariableStore: Vista semplificata per valutazione condizioni
 * Usa varId come chiave (non più nodeId o label)
 */
export type VariableStore = Record<string, any>; // { [varId: string]: semantic value }
