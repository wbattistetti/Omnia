/**
 * Validates FlowDocument shape; throws on invalid data (fail-fast).
 */

import type { FlowDocument } from './FlowDocument';
import { FLOW_DOCUMENT_VERSION } from './FlowDocument';

export function assertFlowDocument(raw: unknown): asserts raw is FlowDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('FlowDocument: expected object');
  }
  const d = raw as Record<string, unknown>;
  if (typeof d.id !== 'string' || !d.id.trim()) throw new Error('FlowDocument: id required');
  if (typeof d.projectId !== 'string' || !d.projectId.trim()) throw new Error('FlowDocument: projectId required');
  if (typeof d.version !== 'number') throw new Error('FlowDocument: version required');
  if (!d.meta || typeof d.meta !== 'object') throw new Error('FlowDocument: meta required');
  const m = d.meta as Record<string, unknown>;
  if (!m.flowInterface || typeof m.flowInterface !== 'object') throw new Error('FlowDocument: meta.flowInterface required');
  if (!m.translations || typeof m.translations !== 'object') throw new Error('FlowDocument: meta.translations required');
  if (!Array.isArray(d.nodes)) throw new Error('FlowDocument: nodes must be array');
  if (!Array.isArray(d.edges)) throw new Error('FlowDocument: edges must be array');
  if (!Array.isArray(d.tasks)) throw new Error('FlowDocument: tasks must be array');
  if (!Array.isArray(d.variables)) throw new Error('FlowDocument: variables must be array');
  if (!Array.isArray(d.bindings)) throw new Error('FlowDocument: bindings must be array');
}

export function normalizeFlowDocumentVersion(doc: FlowDocument): FlowDocument {
  if (doc.version === FLOW_DOCUMENT_VERSION) return doc;
  throw new Error(`FlowDocument: unsupported version ${doc.version} (expected ${FLOW_DOCUMENT_VERSION})`);
}

/**
 * Coerces API/DB payloads into a shape that passes {@link assertFlowDocument} (missing arrays, partial meta).
 */
export function normalizeIncomingFlowDocument(raw: unknown, fallbackProjectId: string): FlowDocument {
  if (!raw || typeof raw !== 'object') {
    throw new Error('FlowDocument: expected object');
  }
  const d = raw as Record<string, unknown>;
  const pid = String(d.projectId ?? fallbackProjectId ?? '').trim();
  const metaIn = d.meta && typeof d.meta === 'object' ? (d.meta as Record<string, unknown>) : {};
  const fi =
    metaIn.flowInterface && typeof metaIn.flowInterface === 'object'
      ? (metaIn.flowInterface as Record<string, unknown>)
      : {};
  const tr =
    metaIn.translations && typeof metaIn.translations === 'object'
      ? (metaIn.translations as Record<string, string>)
      : {};
  const fid = String(d.id ?? '').trim() || 'main';
  return {
    id: fid,
    projectId: pid,
    version: typeof d.version === 'number' ? d.version : FLOW_DOCUMENT_VERSION,
    nodes: Array.isArray(d.nodes) ? (d.nodes as FlowDocument['nodes']) : [],
    edges: Array.isArray(d.edges) ? (d.edges as FlowDocument['edges']) : [],
    tasks: Array.isArray(d.tasks) ? (d.tasks as FlowDocument['tasks']) : [],
    variables: Array.isArray(d.variables) ? (d.variables as FlowDocument['variables']) : [],
    bindings: Array.isArray(d.bindings) ? (d.bindings as FlowDocument['bindings']) : [],
    meta: {
      flowInterface: {
        input: Array.isArray(fi.input) ? (fi.input as FlowDocument['meta']['flowInterface']['input']) : [],
        output: Array.isArray(fi.output) ? (fi.output as FlowDocument['meta']['flowInterface']['output']) : [],
      },
      translations: { ...tr },
      ...(metaIn.settings !== undefined && metaIn.settings !== null && typeof metaIn.settings === 'object'
        ? { settings: metaIn.settings as Record<string, unknown> }
        : {}),
    },
  };
}
