/**
 * Maps review backend snapshot → minimal ProjectData + Task seeds for Omnia panels in the portal.
 */

import type { AgentReviewBackendSnapshot } from '@domain/agentReviewChannel/reviewSnapshots';
import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { ProjectData } from '@types/project';
import { TaskType, type Task } from '@types/taskTypes';

function manualEntriesFromSnapshot(
  snapshot: AgentReviewBackendSnapshot | null | undefined
): ManualCatalogEntry[] {
  if (!snapshot) return [];

  if (snapshot.manualEntries?.length) {
    return snapshot.manualEntries.map((e) => ({
      id: e.id,
      label: e.label,
      method: e.method ?? 'GET',
      endpointUrl: e.endpointUrl,
      ...(e.operationId ? { operationId: e.operationId } : {}),
      ...(e.notes ? { notes: e.notes } : {}),
      frozenMeta: { ...e.frozenMeta },
      lastStructuralEditAt: e.lastStructuralEditAt,
      ...(e.openApiFieldNames ? { openApiFieldNames: e.openApiFieldNames } : {}),
      ...(e.portalConnectionId ? { portalConnectionId: e.portalConnectionId } : {}),
      creationMode: e.creationMode ?? 'import',
      importSpecRevealed: e.importSpecRevealed ?? e.creationMode === 'emulate',
    }));
  }

  const now = new Date().toISOString();
  const out: ManualCatalogEntry[] = [];
  for (const row of snapshot.catalogRows) {
    if (!row.sources.manual) continue;
    const binding = row.bindings.find((b) => b.source === 'manual') ?? row.bindings[0];
    if (!binding) continue;
    out.push({
      id: binding.bindingId,
      label: row.label,
      method: row.method,
      endpointUrl: binding.endpointUrl,
      creationMode: 'import',
      importSpecRevealed: true,
      frozenMeta: {
        lastImportedAt: now,
        specSourceUrl: binding.endpointUrl || null,
        contentHash: null,
        importState: 'ok',
      },
      lastStructuralEditAt: now,
    });
  }
  return out;
}

function backendCallTaskFromManualEntry(entry: ManualCatalogEntry): Task {
  return {
    id: entry.id,
    type: TaskType.BackendCall,
    label: entry.label || entry.endpointUrl || 'Backend',
    endpointUrl: entry.endpointUrl,
    method: entry.method ?? 'GET',
  } as Task;
}

function agentTaskStub(taskInstanceId: string, label: string): Task {
  return {
    id: taskInstanceId,
    type: TaskType.AIAgent,
    label: label || 'Agente AI',
  } as Task;
}

export interface ReviewSnapshotProjectContext {
  projectData: ProjectData;
  ephemeralTasks: Task[];
}

/** Builds in-memory project context for the review portal from a published backend snapshot. */
export function buildReviewSnapshotProjectContext(params: {
  projectId: string;
  taskInstanceId: string;
  taskLabel: string;
  backendSnapshot: AgentReviewBackendSnapshot | null | undefined;
}): ReviewSnapshotProjectContext {
  const manualEntries = manualEntriesFromSnapshot(params.backendSnapshot);
  const projectData: ProjectData = {
    id: params.projectId,
    name: params.projectId,
    industry: '',
    agentActs: [],
    userActs: [],
    backendActions: [],
    tasks: [],
    conditions: [],
    macroTasks: [],
    backendCatalog: {
      schemaVersion: 1,
      manualEntries,
      auditLog: [],
      catalogVersion: 1,
    },
  };

  const ephemeralTasks: Task[] = [
    agentTaskStub(params.taskInstanceId, params.taskLabel),
    ...manualEntries.map(backendCallTaskFromManualEntry),
  ];

  return { projectData, ephemeralTasks };
}

/** Catalog rows from graph/tools (not shown in EditorBackendsPanel manual list). */
export function derivedBackendRowsFromSnapshot(
  snapshot: AgentReviewBackendSnapshot | null | undefined
) {
  if (!snapshot?.catalogRows?.length) return [];
  return snapshot.catalogRows.filter((row) => row.sources.graph || row.sources.tools);
}
