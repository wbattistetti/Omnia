/**
 * Binding design-time: lessico, contratto per slot_id e ponte token → backend runtime.
 */

export const BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION = 1 as const;

/** Riga tabella binding persistita (path RECEIVE per merge / audit). */
export interface BackendOutputSlotBindingRow {
  backendTaskId: string;
  apiPath: string;
  slotId: string;
  tokenInPhrase: string;
  format?: string;
  approved?: boolean;
}

/**
 * Contratto canonico per slot_id: tool ConvAI + RECEIVE + SEND opzionale.
 * Una voce per slot semantico (non per token numerato data1/data2).
 */
export interface SlotBackendContract {
  slotId: string;
  /** Nome tool esposto a ConvAI (`deriveExportedToolName`). */
  toolName: string;
  backendTaskId: string;
  /** Path RECEIVE (fillFrom runtime). */
  receive: string;
  /** Parametri SEND OpenAPI collegati allo slot (solo se il flusso lo richiede). */
  send?: string[];
  format?: string;
  approved?: boolean;
}

export interface AgentBackendOutputSlotBindings {
  schemaVersion: typeof BACKEND_OUTPUT_SLOT_BINDING_SCHEMA_VERSION;
  rows: BackendOutputSlotBindingRow[];
  slotContracts: SlotBackendContract[];
  /** Hint surface → sendPath/valueKind (validati su OpenAPI). */
  sendHints?: SurfaceSendHint[];
  sourceFingerprint?: string;
}

/** Ruolo design-time / hint runtime per valorizzazione SEND. */
export type TokenSendRole = 'value' | 'constraint';

/**
 * Hint SEND per surface letterale (design-time; LLM runtime si appoggia a questo + USE OF BACKENDS).
 */
export interface SurfaceSendHint {
  surface: string;
  slotId: string;
  role: TokenSendRole;
  sendPath: string;
  valueKind?: string;
  toolName?: string;
  backendTaskId?: string;
  approved?: boolean;
}

/** Voce deploy: token nella frase → contratto (campi risolti da slotContracts). */
export interface UseCaseTokenBindingJson {
  token: string;
  slotId: string;
  /** Alias esplicito di `receive` nel contratto slot. */
  fillFrom: string;
  toolName?: string;
  sendParams?: string[];
  format?: string;
  /** Hint SEND (path leaf OpenAPI + semantica); opzionale se solo RECEIVE. */
  role?: TokenSendRole;
  sendPath?: string;
  valueKind?: string;
}

/** Forma JSON nel catalogo conversazionale (chiave = slotId). */
export interface SlotBackendContractJson {
  tool: string;
  receive: string;
  send?: string[];
  format?: string;
}

export type SlotBackendContractMap = Record<string, SlotBackendContractJson>;
