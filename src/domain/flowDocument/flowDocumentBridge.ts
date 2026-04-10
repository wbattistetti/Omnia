/**
 * Maps FlowDocument to FlowStore/React load result (graph + meta for UI).
 */

import type { Flow } from '@flows/FlowTypes';
import type { Node } from 'reactflow';
import type { FlowNode } from '@components/Flowchart/types/flowTypes';
import type { FlowDocument } from './FlowDocument';
import { persistedRowsToMappingEntries } from './flowInterfaceAdapters';

/** FLOW.SAVE-BULK REFACTOR — `translations` from document are the UI source after loadFlow. */
export function flowDocumentToFlowMeta(doc: FlowDocument): Flow['meta'] {
  const tr = doc.meta.translations ?? {};
  const input = persistedRowsToMappingEntries(doc.meta.flowInterface.input, tr);
  const output = persistedRowsToMappingEntries(doc.meta.flowInterface.output, tr);
  const meta: Flow['meta'] = {
    translations: { ...tr },
    flowInterface: { input, output },
  };
  if (doc.meta.settings && Object.keys(doc.meta.settings).length > 0) {
    meta.settings = doc.meta.settings;
  }
  return meta;
}

export type FlowDocumentLoadView = {
  nodes: Node<FlowNode>[];
  edges: any[];
  meta?: Flow['meta'];
  document: FlowDocument;
};
