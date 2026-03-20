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
 * Where a variable row is visible in the authoring/runtime UI.
 * Task-bound rows (non-empty taskInstanceId) are always treated as project-wide.
 */
export type VariableScope = 'project' | 'flow';

/** Options when registering a manual variable with a fixed GUID (e.g. semantic slot on a flow canvas). */
export interface EnsureManualVariableOptions {
  scope?: VariableScope;
  scopeFlowId?: string | null;
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
  /** Manual/slot visibility. Omitted or 'project' = visible in every flow. */
  scope?: VariableScope;
  /** When scope is 'flow', the canvas id (e.g. 'main', 'subflow_...'). */
  scopeFlowId?: string | null;
}

/**
 * VariableStore: Vista semplificata per valutazione condizioni
 * Usa varId come chiave (non più nodeId o label)
 */
export type VariableStore = Record<string, any>; // { [varId: string]: semantic value }
