/**
 * HTTP persistence for atomic FlowDocument (single PUT/GET per flow).
 */

import type { FlowId } from './FlowTypes';
import type { FlowDocument } from '../domain/flowDocument/FlowDocument';
import { assertFlowDocument, normalizeIncomingFlowDocument } from '../domain/flowDocument/validateFlowDocument';

const BASE = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/flow-document`;

export async function loadFlowDocument(projectId: string, flowId: FlowId): Promise<FlowDocument> {
  if (!projectId || String(projectId).trim() === '') {
    throw new Error('loadFlowDocument: projectId required');
  }
  const url = `${BASE(projectId)}?flowId=${encodeURIComponent(flowId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`loadFlowDocument_failed:${res.status}`);
  }
  const json = await res.json();
  const normalized = normalizeIncomingFlowDocument(json, projectId);
  assertFlowDocument(normalized);
  return normalized;
}

export async function saveFlowDocument(doc: FlowDocument): Promise<void> {
  const pid = String(doc.projectId || '').trim();
  const fid = String(doc.id || '').trim();
  if (!pid || !fid) {
    throw new Error('saveFlowDocument: document projectId and id required');
  }
  const url = `${BASE(pid)}?flowId=${encodeURIComponent(fid)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    throw new Error(`saveFlowDocument_failed:${res.status}`);
  }
}
