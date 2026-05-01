/**
 * Tipi dominio per il catalogo backend unificato (grafo + Tools agent + voci manuali).
 * Separati da persistence/UI; allineati semanticamente a Task (BackendCall) e ProjectData.
 */

/** Origine voce nel catalogo aggregato (badge/iconcine). */
export type CatalogBindingSource = 'graph' | 'tools' | 'manual';

/** Contratto OpenAPI / stato import (snapshot designer-time sul task o voce manuale). */
export type FrozenImportState = 'none' | 'ok' | 'error';

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
