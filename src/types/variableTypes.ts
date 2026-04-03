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
 * Manual rows: `project` = global across flows; `flow` + scopeFlowId = one canvas.
 * Task-bound rows use `flow` + scopeFlowId for their owning flow (per-flow namespace).
 */
export type VariableScope = 'project' | 'flow';

/** Options when registering a manual variable with a fixed GUID (e.g. semantic slot on a flow canvas). */
export interface EnsureManualVariableOptions {
  scope?: VariableScope;
  scopeFlowId?: string | null;
}

/**
 * VariableInstance: Variabile associata a un'istanza di task.
 * Identity: `id` is always a GUID. For task-bound rows, `id` equals TaskTreeNode.id.
 * `dataPath` is the JSON path into the instance payload (not an identity key).
 */
export interface VariableInstance {
  id: string;
  varName: string;
  taskInstanceId: string;
  dataPath: string;
  /** Manual/slot visibility. Omitted or 'project' = visible in every flow. */
  scope?: VariableScope;
  /** When scope is 'flow', the canvas id (e.g. 'main', 'subflow_...'). */
  scopeFlowId?: string | null;
  /**
   * Phase 5: subflow interface binding persisted as minimal `{ from, to }` on the variable document.
   * Labels resolve via translations on `id`.
   */
  bindingFrom?: string;
  bindingTo?: string;
}

/**
 * VariableStore: Runtime map from variable GUID to semantic value (DSL / conditions use [GUID]).
 */
export type VariableStore = Record<string, any>; // { [id: string]: semantic value }
