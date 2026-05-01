/**
 * Eventi applicativi per invalidazione catalogo (versione contratto {@link DOMAIN_EVENT_VERSION}).
 */

export const DOMAIN_EVENT_VERSION = 1 as const;

export type FlowBackendCallsChanged = {
  v: typeof DOMAIN_EVENT_VERSION;
  type: 'FlowBackendCallsChanged';
  projectId: string;
  taskIds: readonly string[];
  reason: 'create' | 'update' | 'delete';
};

export type AgentToolsUrlsChanged = {
  v: typeof DOMAIN_EVENT_VERSION;
  type: 'AgentToolsUrlsChanged';
  projectId: string;
  agentTaskId: string;
};

export type ManualCatalogEntryChanged = {
  v: typeof DOMAIN_EVENT_VERSION;
  type: 'ManualCatalogEntryChanged';
  projectId: string;
  entryId: string;
  op: 'create' | 'update' | 'delete';
};

export type SpecImportResult = {
  v: typeof DOMAIN_EVENT_VERSION;
  type: 'SpecImportResult';
  projectId: string;
  bindingId: string;
  ok: boolean;
  sourceUrl: string;
  contentHash?: string;
  errorCode?: string;
};

export type CatalogRebuildSummary = {
  v: typeof DOMAIN_EVENT_VERSION;
  type: 'CatalogRebuildSummary';
  projectId: string;
  trigger: string;
  entryCount: number;
  durationMs: number;
};

export type BackendCatalogDomainEvent =
  | FlowBackendCallsChanged
  | AgentToolsUrlsChanged
  | ManualCatalogEntryChanged
  | SpecImportResult
  | CatalogRebuildSummary;
