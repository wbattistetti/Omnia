/**
 * Snapshot blocks published on the review channel (read-only reference for the portal).
 * Kept separate from the content hash — reviewers edit task/prompts; snapshots are Omnia photos.
 */

export interface AgentReviewKbDocumentSnapshot {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  addedAt: string;
  parseStatus: 'parsing' | 'ready' | 'error' | 'unsupported';
  parseError?: string;
  format?: string;
  howToUseText?: string;
  markdownSnippet?: string;
  repositoryDocumentId?: string;
  dataTypes?: readonly string[];
}

export interface AgentReviewKnowledgeBaseSnapshot {
  documents: AgentReviewKbDocumentSnapshot[];
}

export interface AgentReviewBackendBindingSnapshot {
  bindingId: string;
  source: 'graph' | 'tools' | 'manual';
  method: string;
  endpointUrl: string;
}

export interface AgentReviewBackendRowSnapshot {
  key: string;
  label: string;
  method: string;
  pathnameDisplay: string;
  sources: { graph: boolean; tools: boolean; manual: boolean };
  bindings: AgentReviewBackendBindingSnapshot[];
}

export interface AgentReviewStructuredBackendPlaceholderSnapshot {
  id: string;
  definitionId: string;
}

export interface AgentReviewBackendSnapshot {
  catalogRows: AgentReviewBackendRowSnapshot[];
  structuredPlaceholders: AgentReviewStructuredBackendPlaceholderSnapshot[];
  /** Full manual catalog rows bound to this agent at publish (portal hydrates EditorBackendsPanel). */
  manualEntries?: AgentReviewManualBackendEntrySnapshot[];
}

/** Serializable subset of {@link ManualCatalogEntry} for review publish round-trip. */
export interface AgentReviewManualBackendEntrySnapshot {
  id: string;
  label: string;
  method?: string;
  endpointUrl: string;
  operationId?: string;
  notes?: string;
  frozenMeta: {
    lastImportedAt: string | null;
    specSourceUrl: string | null;
    contentHash: string | null;
    importState: 'none' | 'pending' | 'ok' | 'error';
    lastError?: string;
    structuralFingerprintAtLastOkImport?: string | null;
  };
  lastStructuralEditAt: string;
  openApiFieldNames?: { inputs: string[]; outputs: string[] };
  portalConnectionId?: string;
  creationMode?: 'import' | 'emulate';
  importSpecRevealed?: boolean;
}

export interface AgentReviewConversationalRuleSnapshot {
  id: string;
  libraryRuleId: string | null;
  label: string;
  scenario: string;
  exampleMessage: string;
  sort_order: number;
  enabled?: boolean;
}

export interface AgentReviewConversationStyleEntrySnapshot {
  checked: boolean;
  description: string;
  example: string;
}

export interface AgentReviewConversationSnapshot {
  conversationalRules: AgentReviewConversationalRuleSnapshot[];
  styleAuto: boolean;
  styleSelections: Record<string, AgentReviewConversationStyleEntrySnapshot>;
  globalStyleId: string;
  styleLearningNotes: string;
  deployStyleId: string | null;
}

function isKbDocumentSnapshot(raw: unknown): raw is AgentReviewKbDocumentSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.parseStatus === 'string'
  );
}

export function parseKnowledgeBaseSnapshot(raw: unknown): AgentReviewKnowledgeBaseSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const docs = (raw as { documents?: unknown }).documents;
  if (!Array.isArray(docs) || docs.length === 0) return undefined;
  const documents = docs.filter(isKbDocumentSnapshot);
  return documents.length > 0 ? { documents } : undefined;
}

function isBackendBindingSnapshot(raw: unknown): raw is AgentReviewBackendBindingSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.bindingId === 'string' &&
    typeof o.source === 'string' &&
    typeof o.method === 'string'
  );
}

function isBackendRowSnapshot(raw: unknown): raw is AgentReviewBackendRowSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.key !== 'string' || typeof o.label !== 'string') return false;
  if (!Array.isArray(o.bindings)) return false;
  return o.bindings.every(isBackendBindingSnapshot);
}

export function parseBackendSnapshot(raw: unknown): AgentReviewBackendSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const catalogRows = Array.isArray(o.catalogRows)
    ? o.catalogRows.filter(isBackendRowSnapshot)
    : [];
  const structuredPlaceholders = Array.isArray(o.structuredPlaceholders)
    ? o.structuredPlaceholders.filter(
        (p): p is AgentReviewStructuredBackendPlaceholderSnapshot =>
          p != null &&
          typeof p === 'object' &&
          typeof (p as AgentReviewStructuredBackendPlaceholderSnapshot).id === 'string' &&
          typeof (p as AgentReviewStructuredBackendPlaceholderSnapshot).definitionId === 'string'
      )
    : [];
  const manualEntries = Array.isArray(o.manualEntries)
    ? o.manualEntries.filter(isManualBackendEntrySnapshot)
    : undefined;
  if (catalogRows.length === 0 && structuredPlaceholders.length === 0 && !manualEntries?.length) {
    return undefined;
  }
  return {
    catalogRows,
    structuredPlaceholders,
    ...(manualEntries?.length ? { manualEntries } : {}),
  };
}

function isManualBackendEntrySnapshot(raw: unknown): raw is AgentReviewManualBackendEntrySnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.label !== 'string') return false;
  if (typeof o.endpointUrl !== 'string') return false;
  if (!o.frozenMeta || typeof o.frozenMeta !== 'object') return false;
  return typeof o.lastStructuralEditAt === 'string';
}

function isConversationalRuleSnapshot(raw: unknown): raw is AgentReviewConversationalRuleSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const o = raw as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.label === 'string';
}

function parseStyleSelections(
  raw: unknown
): Record<string, AgentReviewConversationStyleEntrySnapshot> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, AgentReviewConversationStyleEntrySnapshot> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    out[k] = {
      checked: Boolean(e.checked),
      description: typeof e.description === 'string' ? e.description : '',
      example: typeof e.example === 'string' ? e.example : '',
    };
  }
  return out;
}

export function parseConversationSnapshot(raw: unknown): AgentReviewConversationSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const rules = Array.isArray(o.conversationalRules)
    ? o.conversationalRules.filter(isConversationalRuleSnapshot)
    : [];
  const styleSelections = parseStyleSelections(o.styleSelections);
  const hasRules = rules.length > 0;
  const hasStyles = Object.keys(styleSelections).length > 0;
  const hasMeta =
    o.styleAuto === true ||
    (typeof o.globalStyleId === 'string' && o.globalStyleId.trim() !== '') ||
    (typeof o.styleLearningNotes === 'string' && o.styleLearningNotes.trim() !== '') ||
    o.deployStyleId != null;
  if (!hasRules && !hasStyles && !hasMeta) return undefined;
  return {
    conversationalRules: rules,
    styleAuto: Boolean(o.styleAuto),
    styleSelections,
    globalStyleId: typeof o.globalStyleId === 'string' ? o.globalStyleId : '',
    styleLearningNotes: typeof o.styleLearningNotes === 'string' ? o.styleLearningNotes : '',
    deployStyleId:
      typeof o.deployStyleId === 'string'
        ? o.deployStyleId
        : o.deployStyleId === null
          ? null
          : null,
  };
}

export function hasReviewSnapshotContent(params: {
  knowledgeBase?: AgentReviewKnowledgeBaseSnapshot;
  backends?: AgentReviewBackendSnapshot;
  conversation?: AgentReviewConversationSnapshot;
}): boolean {
  return Boolean(
    params.knowledgeBase?.documents.length ||
      params.backends?.catalogRows.length ||
      params.backends?.structuredPlaceholders.length ||
      params.conversation?.conversationalRules.length ||
      Object.keys(params.conversation?.styleSelections ?? {}).length ||
      params.conversation?.styleLearningNotes?.trim()
  );
}

/** Catalog rows from graph/tools (read-only; not in manual backend accordion). */
export function derivedBackendRowsFromSnapshot(
  snapshot: AgentReviewBackendSnapshot | null | undefined
): AgentReviewBackendRowSnapshot[] {
  if (!snapshot?.catalogRows?.length) return [];
  return snapshot.catalogRows.filter((row) => row.sources.graph || row.sources.tools);
}
