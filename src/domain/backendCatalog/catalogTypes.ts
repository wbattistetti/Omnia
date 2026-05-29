/**
 * Tipi dominio per il catalogo backend unificato (grafo + Tools agent + voci manuali).
 * Separati da persistence/UI; allineati semanticamente a Task (BackendCall) e ProjectData.
 */

import type { AgentBackendAnalysisSnapshot } from '../backendAnalysis/backendAnalysisTypes';

/** Origine voce nel catalogo aggregato (badge/iconcine). */
export type CatalogBindingSource = 'graph' | 'tools' | 'manual';

/** Contratto OpenAPI / stato import (snapshot designer-time sul task o voce manuale). */
export type FrozenImportState = 'none' | 'ok' | 'error';

/**
 * Regole compile-time SEND derivate da `x-omnia.sendBinding` sullo schema body OpenAPI.
 * Opzionale: lista nomi API; gruppi: almeno un’alternativa con tutti i parametri valorizzati.
 */
export type OpenApiSendBindingRules = {
  optionalApiParams: string[];
  /**
   * Parametri SEND obbligatori a compile (design-time), es. `projectId` su BookFromAgenda.
   * Distinti da `optionalApiParams` (runtime-only o facoltativi in designer).
   */
  designTimeRequiredApiParams?: string[];
  requireOneOfSets?: Array<{
    id: string;
    label?: string;
    alternatives: Array<{ allApiParams: string[] }>;
  }>;
};

/**
 * Meta persistita opzionale sul Task Backend Call dopo Read API (`BackendCallEditor`).
 * Usata per badge stale (enum) senza rifetch continuo.
 */
export interface BackendCallSpecMeta {
  schemaVersion: 1;
  /** Ultimo Read API riuscito (ISO). */
  lastImportedAt: string | null;
  /** Hash contenuto documento OpenAPI (stringa compatta). */
  contentHash: string | null;
  importState: FrozenImportState;
  lastError?: string;
  /**
   * Impronta `method|url` normalizzati al momento dell’ultimo import ok.
   * Se l’endpoint cambia ma non si rifà Read API → stale strutturale.
   */
  structuralFingerprint: string | null;
  /**
   * Ultimo testo `description` letto dallo OpenAPI per nome campo API (dopo Read API ok).
   * Riempie `fieldDescription` vuoti al Read successivo e serve al confronto drift con il testo locale.
   */
  openapiDescriptionSnapshots?: {
    inputs: Record<string, string>;
    outputs: Record<string, string>;
  };
  /** Hint per path dotted (wireKey): descrizione, esempio, tipo/formato da OpenAPI inline. */
  openapiParamHintsByPath?: {
    inputs: Record<string, import('../../services/openApiParamPathHints').OpenApiParamPathHint>;
    outputs: Record<string, import('../../services/openApiParamPathHints').OpenApiParamPathHint>;
  };
  /**
   * Dopo Read API: tipo UI suggerito per parametro/property body (chiave = nome API come in SEND).
   * Valori: `text` | `number` | `boolean` | `date` | `time` | `datetime-local` | `uri` | `enum` (allineati a controlli SEND/mock).
   */
  openapiInputUiKindByApiName?: Record<string, string>;
  /** Se lo schema OpenAPI dichiara `enum` per il campo, lista valori ammessi (stessa chiave API). */
  openapiInputEnumByApiName?: Record<string, string[]>;
  /**
   * Frammenti JSON Schema per proprietà top-level del body (Read API), `$ref` risolti — schema tool ConvAI fedele a OpenAPI.
   */
  openapiInputJsonSchemaByApiName?: Record<string, Record<string, unknown>>;
  /** Frammenti JSON Schema top-level risposta 2xx (Read API). */
  openapiOutputJsonSchemaByApiName?: Record<string, Record<string, unknown>>;
  /** OpenAPI `operationId` dell’operazione scelta al Read API (per naming tool verso ConvAI). */
  openapiOperationId?: string | null;
  /** Regole obbligatorietà SEND da `x-omnia.sendBinding` (se presenti nello spec). `null` = assenti dopo import. */
  openapiSendBinding?: OpenApiSendBindingRules | null;
  /**
   * Ultimo Read API: pathname dell’endpoint operativo trovato nello Swagger/OpenAPI (match esplicito sul path).
   * Se true e `openApiMethodLockUrlSnapshot` coincide con l’URL operativo corrente, il metodo HTTP è solo lettura (da spec).
   */
  openApiMethodLocked?: boolean;
  /** URL (trim) usato al lock; se diverso dall’endpoint operativo → selezione manuale GET/POST. */
  openApiMethodLockUrlSnapshot?: string | null;
  /** Metodo HTTP risolto dallo spec quando il lock è attivo (es. POST). */
  openApiLockedHttpMethod?: string | null;
  /**
   * Ultimo Read API: errori compilazione schema (tipi/format mancanti) per Monaco in tab Backends.
   * Vuoto = nessun problema rilevato sullo snapshot materializzato.
   */
  openapiCompileErrors?: string[];
}

/** Come è stata creata la riga nel catalogo (wizard passo Backend). */
export type ManualBackendCreationMode = 'import' | 'emulate';

/** Tipo tool ConvAI nel workspace ElevenLabs (v1: solo webhook attivo). */
export type ElevenLabsWorkspaceToolKind = 'webhook' | 'client' | 'integration';

/** Metadati per backend catalogo creati da «Aggiungi strumento» nel workspace ElevenLabs. */
export interface ElevenLabsWorkspaceToolMeta {
  kind: ElevenLabsWorkspaceToolKind;
  scope: 'agent' | 'node';
  /** Richiesto se `scope === 'node'`. */
  nodeId?: string;
  agentId?: string;
}

/** Voce manuale nel progetto (`project.backendCatalog.manualEntries`). */
export interface ManualCatalogEntry {
  id: string;
  label: string;
  method?: string;
  endpointUrl: string;
  operationId?: string;
  notes?: string;
  frozenMeta: CatalogFrozenMeta;
  /** Bump quando l’utente modifica URL/metodo senza re-import. */
  lastStructuralEditAt: string;
  /** Nomi campo da OpenAPI dopo Enter / lettura spec (solo designer-time). */
  openApiFieldNames?: { inputs: string[]; outputs: string[] };
  /** Connessione OAuth verso l’origin dell’URL (Bearer in Read API / runtime). */
  portalConnectionId?: string;
  /**
   * Wizard: `import` = solo URL fino a «Recupera specifiche»; `emulate` = tutti i campi subito.
   * Legacy senza campo → trattato come `import` se non ancora rivelato, altrimenti emulate.
   */
  creationMode?: ManualBackendCreationMode;
  /** Import: true dopo primo Recupera OpenAPI ok (mostra Nome/Descrizione). */
  importSpecRevealed?: boolean;
  /** Presente se la voce è un tool draft dal workspace ElevenLabs (non dal wizard Agente AI). */
  elevenLabsWorkspaceTool?: ElevenLabsWorkspaceToolMeta;
  /** Id tool ConvAI dopo «Pubblica su ElevenLabs» (POST /convai/tools). */
  elevenLabsConvaiToolId?: string;
  /** Ultimo agente ConvAI a cui il tool è stato agganciato (`tool_ids`). */
  elevenLabsConvaiAgentId?: string;
}

export interface CatalogFrozenMeta {
  lastImportedAt: string | null;
  specSourceUrl: string | null;
  contentHash: string | null;
  importState: FrozenImportState;
  lastError?: string;
  /**
   * Valore {@link structuralFingerprint} all’ultimo import riuscito.
   * Confronto con fingerprint corrente → {@link SpecStaleReason.STRUCTURAL_DRIFT}.
   */
  structuralFingerprintAtLastOkImport?: string | null;
}

/** Snapshot progetto per catalogo + audit append-only (vedi `ProjectData.backendCatalog`). */
export interface ProjectBackendCatalogBlob {
  schemaVersion: 1;
  manualEntries: ManualCatalogEntry[];
  /** Audit append-only in memoria progetto (subset whitelist). */
  auditLog: CatalogAuditEntry[];
  catalogVersion: number;
  /** Analisi uso backend per task agente (chiave = agentTaskId). */
  agentAnalysisByTaskId?: Record<string, AgentBackendAnalysisSnapshot>;
}

/** Voce audit serializzabile (no payload OpenAPI intero). */
export interface CatalogAuditEntry {
  schemaVersion: 1;
  id: string;
  ts: string;
  projectId: string;
  kind: CatalogAuditKind;
  payload: Record<string, unknown>;
}

export type CatalogAuditKind =
  | 'manual_catalog_crud'
  | 'spec_import_result'
  | 'catalog_rebuilt_summary';

/** Riferimento derivato da TaskRepository (una riga Backend Call o URL agent). */
export interface DerivedBackendRef {
  source: Extract<CatalogBindingSource, 'graph' | 'tools'>;
  taskId: string;
  method: string;
  pathnameDisplay: string;
  endpointUrlForImport: string;
  operationId?: string;
  label: string;
  frozenMeta: CatalogFrozenMeta;
  lastStructuralEditAt: string;
}

/** Binding nella riga aggregata (una per fonte coinvolta). */
export interface CatalogBinding {
  bindingId: string;
  source: CatalogBindingSource;
  taskId?: string;
  manualEntryId?: string;
  endpointUrl: string;
  method: string;
  frozenMeta: CatalogFrozenMeta;
  lastStructuralEditAt: string;
}

/** Motivi badge stale (UX tooltip); non mischiare con refresh lista catalogo. */
export enum SpecStaleReason {
  /** Mai eseguito Read API / import. */
  NO_CONTRACT = 'NO_CONTRACT',
  /** URL o metodo cambiati dopo ultimo import ok. */
  STRUCTURAL_DRIFT = 'STRUCTURAL_DRIFT',
  /** Ultimo tentativo import in errore. */
  IMPORT_ERROR = 'IMPORT_ERROR',
  /** Ultimo import ok e fingerprint ancora allineato. */
  FRESH = 'FRESH',
}

/** Riga aggregata nel pannello Lista backend. */
export interface CatalogRow {
  key: string;
  sources: { graph: boolean; tools: boolean; manual: boolean };
  method: string;
  pathnameDisplay: string;
  label: string;
  bindings: CatalogBinding[];
}
