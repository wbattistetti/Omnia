/**
 * Immutable debugger step — single source of truth for debugger UI, flow highlight, and persistence.
 * @see docs in workspace rules for serializable replay.
 */

export const DEBUGGER_STEP_SCHEMA_VERSION = 1 as const;

/** Grammar engine used for the winning parse (only winner is stored). */
export type DebuggerGrammarInfo = {
  type: string;
  contract: string;
  elapsedMs: number;
};

/**
 * Core step record. Extended fields are optional for forward compatibility.
 */
export type DebuggerStep = {
  /** Stable id for lists / persistence (not the flow node id). */
  id: string;
  /** Correlazione con il messaggio utente in chat (`Message.id`). */
  clientMessageId?: string;
  utterance: string;
  semanticValue: string;
  linguisticValue: string;
  grammar: DebuggerGrammarInfo;
  /** Etichetta slot / nodo atteso (best-effort, es. label canvas). */
  slotLabel?: string;
  activeNodeId: string;
  passedNodeIds: string[];
  noMatchNodeIds: string[];
  activeEdgeId: string;
  botResponse?: string;
  botResponsePlaceholders?: Record<string, string>;
  variables?: Record<string, unknown>;
  note?: string;
  tags?: string[];
};

export type PersistedDebuggerStep = Omit<DebuggerStep, 'id'> & { id?: string };

export type DebuggerConversationSnapshot = {
  schemaVersion: typeof DEBUGGER_STEP_SCHEMA_VERSION;
  flowId: string;
  projectId: string;
  savedAt: string;
  steps: PersistedDebuggerStep[];
};

export function createStepId(): string {
  return `dbg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
