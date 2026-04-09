/**
 * Applies a loaded FlowDocument to TaskRepository and VariableCreationService (project-scoped memory).
 * FlowDocument is the source of truth; global stores receive a per-flow snapshot.
 */

import type { FlowDocument } from './FlowDocument';
import { assertFlowDocument, normalizeFlowDocumentVersion } from './validateFlowDocument';
import { taskRepository } from '@services/TaskRepository';
import { variableCreationService } from '@services/VariableCreationService';

export function applyFlowDocumentToStores(doc: FlowDocument): void {
  assertFlowDocument(doc);
  const normalized = normalizeFlowDocumentVersion(doc);
  const pid = String(normalized.projectId || '').trim();
  const fid = String(normalized.id || '').trim();
  if (!pid || !fid) {
    throw new Error('applyFlowDocumentToStores: document id and projectId required');
  }

  taskRepository.ingestTasksFromFlowDocument(fid, normalized.tasks);
  variableCreationService.ingestVariablesFromFlowDocument(pid, fid, normalized.variables, normalized.tasks);
}
