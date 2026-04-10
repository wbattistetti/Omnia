/**
 * HTTP persistence for atomic FlowDocument (single PUT/GET per flow).
 */

import type { FlowId } from './FlowTypes';
import type { FlowDocument } from '../domain/flowDocument/FlowDocument';
import { assertFlowDocument, normalizeIncomingFlowDocument } from '../domain/flowDocument/validateFlowDocument';
import { logFlowHydrationTrace } from '../utils/flowHydrationTrace';
import { logFlowSaveDebug } from '../utils/flowSaveDebug';
import { formatUnknownError, readHttpErrorBody } from '../utils/httpErrorFormatting';

const BASE = (projectId: string) => `/api/projects/${encodeURIComponent(projectId)}/flow-document`;

export async function loadFlowDocument(projectId: string, flowId: FlowId): Promise<FlowDocument> {
  if (!projectId || String(projectId).trim() === '') {
    throw new Error('loadFlowDocument: projectId required');
  }
  const url = `${BASE(projectId)}?flowId=${encodeURIComponent(flowId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await readHttpErrorBody(res);
    logFlowHydrationTrace('loadFlowDocument HTTP error', {
      url,
      projectId,
      flowId,
      status: res.status,
      detail,
    });
    logFlowSaveDebug('loadFlowDocument: GET failed', {
      projectId,
      flowId,
      status: res.status,
      detail,
    });
    throw new Error(
      `loadFlowDocument_failed HTTP ${res.status}${detail ? `: ${detail}` : ''} (GET flow-document)`
    );
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    const msg = formatUnknownError(e);
    throw new Error(`loadFlowDocument_failed: invalid JSON in response (GET flow-document): ${msg}`);
  }
  const rawNodes = Array.isArray((json as any)?.nodes) ? (json as any).nodes.length : -1;
  const rawEdges = Array.isArray((json as any)?.edges) ? (json as any).edges.length : -1;
  logFlowHydrationTrace('loadFlowDocument response (raw JSON before normalize)', {
    url,
    projectId,
    flowId,
    rawNodeCount: rawNodes,
    rawEdgeCount: rawEdges,
  });
  const normalized = normalizeIncomingFlowDocument(json, projectId);
  try {
    assertFlowDocument(normalized);
  } catch (e) {
    const msg = formatUnknownError(e);
    throw new Error(`FlowDocument invalid after normalize: ${msg}`);
  }
  logFlowHydrationTrace('loadFlowDocument normalized document', {
    projectId,
    flowId,
    normalizedNodeCount: normalized.nodes.length,
    normalizedEdgeCount: normalized.edges.length,
    taskCount: normalized.tasks.length,
  });
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
  logFlowHydrationTrace('saveFlowDocument PUT', {
    url,
    flowId: fid,
    projectId: pid,
    docNodeCount: Array.isArray(doc.nodes) ? doc.nodes.length : -1,
    docEdgeCount: Array.isArray(doc.edges) ? doc.edges.length : -1,
    ok: res.ok,
    status: res.status,
  });
  if (!res.ok) {
    const detail = await readHttpErrorBody(res);
    logFlowHydrationTrace('saveFlowDocument HTTP error', {
      url,
      flowId: fid,
      projectId: pid,
      status: res.status,
      detail,
    });
    logFlowSaveDebug('saveFlowDocument: PUT failed', {
      projectId: pid,
      flowId: fid,
      status: res.status,
      detail,
    });
    throw new Error(
      `saveFlowDocument_failed HTTP ${res.status}${detail ? `: ${detail}` : ''} (PUT flow-document)`
    );
  }
}
