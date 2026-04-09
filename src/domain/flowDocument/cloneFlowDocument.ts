/**
 * Deep-clone a FlowDocument with new id and optional projectId (template / duplicate flow).
 */

import type { FlowDocument } from './FlowDocument';
import { FLOW_DOCUMENT_VERSION } from './FlowDocument';

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `flow_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function cloneFlowDocument(doc: FlowDocument, options?: { newFlowId?: string; projectId?: string }): FlowDocument {
  const id = options?.newFlowId?.trim() || newId();
  const projectId = options?.projectId?.trim() || doc.projectId;
  const raw = JSON.parse(JSON.stringify(doc)) as FlowDocument;
  return {
    ...raw,
    id,
    projectId,
    version: FLOW_DOCUMENT_VERSION,
    meta: {
      ...raw.meta,
      flowInterface: {
        input: raw.meta.flowInterface.input.map((r) => ({ ...r, id: newId() })),
        output: raw.meta.flowInterface.output.map((r) => ({ ...r, id: newId() })),
      },
    },
  };
}
