/**
 * Flow-centric domain: FlowDocument as the atomic unit for canvas + tasks + variables + interface + translations.
 */

export type {
  FlowDocument,
  FlowDocumentMeta,
  FlowDocumentSimplifiedEdge,
  FlowDocumentSimplifiedNode,
  FlowInterfaceRowPersisted,
  FlowSubflowBindingPersisted,
} from './FlowDocument';
export { FLOW_DOCUMENT_VERSION } from './FlowDocument';
export {
  assertFlowDocument,
  normalizeFlowDocumentVersion,
  normalizeIncomingFlowDocument,
} from './validateFlowDocument';
export { applyFlowDocumentToStores } from './applyFlowDocumentToStores';
export { cloneFlowDocument } from './cloneFlowDocument';
export { flowDocumentToFlowMeta, type FlowDocumentLoadView } from './flowDocumentBridge';
export { buildFlowDocumentFromFlowSlice } from './flowDocumentSerialize';
export {
  mappingEntriesToPersistedInput,
  mappingEntriesToPersistedOutput,
  persistedRowsToMappingEntries,
} from './flowInterfaceAdapters';
