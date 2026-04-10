/**
 * Hydrates in-memory TaskRepository + VariableCreationService from a loaded FlowDocument
 * so synchronous getters match the document before React applies the flow slice.
 * Authoring authority for save is the FlowStore slice (tasks/variables) kept in sync via
 * {@link syncTaskAuthoringIntoFlowSlice} and variable slice updates after hydration.
 */

import type { FlowDocument } from './FlowDocument';
import { assertFlowDocument, normalizeFlowDocumentVersion } from './validateFlowDocument';
import { notifyFlowSliceTranslationsChanged } from './notifyFlowSliceTranslationsChanged';
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
  notifyFlowSliceTranslationsChanged();
}
