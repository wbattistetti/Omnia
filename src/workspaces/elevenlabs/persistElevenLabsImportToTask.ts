/**
 * Persists an ElevenLabs workflow node import into a task via TaskRepository (outside AI Agent editor dock).
 */

import { appendAuditEntry } from '../../application/backendCatalog/appendOnlyAuditLog';
import type { ManualCatalogEntry, ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';
import type {
  WorkspaceAgentSettings,
  WorkspaceAgentToolInventory,
  WorkspaceWorkflowNode,
} from '../core/types';
import {
  importElevenLabsNodeToOmnia,
  type ElevenLabsDescriptionImportMode,
  type ElevenLabsWebhookImportScope,
} from './elevenLabsOmniaImport';
import type { ElevenLabsImportRecap } from './elevenLabsImportRecap';
import { AGENT_WIZARD_FIRST_STEP_INDEX } from '@domain/aiAgentConstruction/agentConstructionPhase';
import type { AIAgentProposedVariable } from '@types/aiAgentDesign';
import { taskRepository } from '@services/TaskRepository';
import type { Task } from '@types/taskTypes';
import type { IAAgentConfig } from 'types/iaAgentRuntimeSetup';
import { OMNIA_AI_AGENT_REHYDRATE_FROM_REPO } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentDockPanelIds';
import { ProjectDataService } from '@services/ProjectDataService';
import { normalizeProjectData } from '@utils/normalizers';
import type { ProjectData } from '@types/project';

function readProjectData(): ProjectData | null {
  const w = typeof window !== 'undefined' ? (window as { __projectData?: ProjectData }).__projectData : null;
  return w && typeof w === 'object' ? w : null;
}

function parseIaConfig(task: Task): IAAgentConfig {
  const raw = String(task.agentIaRuntimeOverrideJson ?? '').trim();
  if (!raw) return { platform: 'elevenlabs', convaiBackendToolTaskIds: [] };
  try {
    return JSON.parse(raw) as IAAgentConfig;
  } catch {
    return { platform: 'elevenlabs', convaiBackendToolTaskIds: [] };
  }
}

export type PersistElevenLabsImportOptions = {
  webhookScope?: ElevenLabsWebhookImportScope;
  descriptionImportMode?: ElevenLabsDescriptionImportMode;
  /** Dopo drop canvas: salta tutor, marca generazione, recap in runtime JSON. */
  fromFlowDrop?: boolean;
  remoteAgentId?: string;
};

/**
 * Merges remote node content into task + project backend catalog; notifies open AI Agent editors.
 */
export function persistElevenLabsImportToTask(
  taskInstanceId: string,
  node: WorkspaceWorkflowNode,
  agentName: string,
  settings: WorkspaceAgentSettings,
  toolInventory: WorkspaceAgentToolInventory,
  options?: PersistElevenLabsImportOptions
): {
  promptApplied: boolean;
  variableNames: readonly string[];
  backendsAdded: number;
  backendsLinked: number;
} {
  const task = taskRepository.getTask(taskInstanceId);
  if (!task) {
    throw new Error(`Task non trovato: ${taskInstanceId}`);
  }

  let nextDescription = String(task.agentDesignDescription || '');
  let proposedFields: AIAgentProposedVariable[] = Array.isArray(task.agentProposedFields)
    ? task.agentProposedFields.map((f) => ({ ...f }))
    : [];

  const pd = readProjectData();
  const projectId = pd?.id?.trim() || undefined;
  const prevCatalog: ProjectBackendCatalogBlob = pd?.backendCatalog ?? {
    schemaVersion: 1,
    manualEntries: [],
    auditLog: [],
    catalogVersion: 0,
  };
  let nextManualEntries: ManualCatalogEntry[] = [...(prevCatalog.manualEntries ?? [])];
  const iaCfg = parseIaConfig(task);
  let nextConvaiIds = [...(iaCfg.convaiBackendToolTaskIds ?? [])];

  const result = importElevenLabsNodeToOmnia({
    node,
    agentName,
    settings,
    toolInventory,
    webhookScope: options?.webhookScope,
    descriptionImportMode: options?.descriptionImportMode,
    targets: {
      designDescription: nextDescription,
      setDesignDescription: (value) => {
        nextDescription = value;
      },
      proposedFields,
      onUpdateProposedField: (slotId, patch) => {
        proposedFields = proposedFields.map((f) =>
          f.slotId === slotId ? { ...f, ...patch } : f
        );
      },
      addProposedFields: (fields) => {
        proposedFields = [...proposedFields, ...fields];
      },
    },
    backends: {
      projectId,
      manualEntries: nextManualEntries,
      setManualEntries: (entries) => {
        nextManualEntries = entries;
      },
      convaiBackendToolTaskIds: nextConvaiIds,
      setConvaiBackendToolTaskIds: (ids) => {
        nextConvaiIds = ids;
      },
    },
  });

  const auditLog = appendAuditEntry(prevCatalog.auditLog ?? [], {
    projectId: projectId ?? '',
    kind: 'manual_catalog_crud',
    payload: { op: 'elevenlabs_import', nodeId: node.id, added: result.backendsAdded },
  });
  const nextCatalog: ProjectBackendCatalogBlob = {
    schemaVersion: 1,
    manualEntries: nextManualEntries,
    auditLog,
    catalogVersion: (prevCatalog.catalogVersion ?? 0) + 1,
  };

  if (pd) {
    const updated = normalizeProjectData({ ...pd, backendCatalog: nextCatalog });
    ProjectDataService.syncBackendCatalogFromProvider(updated.backendCatalog);
    (window as { __projectData?: ProjectData }).__projectData = updated;
  }

  const hasImportedContent =
    result.promptApplied || result.variableNames.length > 0 || result.backendsLinked > 0;

  let recap: ElevenLabsImportRecap | undefined;
  if (options?.fromFlowDrop) {
    recap = {
      nodeLabel: String(node.label || '').trim() || 'Nodo ElevenLabs',
      remoteAgentId: String(options.remoteAgentId || iaCfg.convaiAgentId || '').trim(),
      remoteAgentName: agentName.trim(),
      promptApplied: result.promptApplied,
      variableCount: result.variableNames.length,
      backendsAdded: result.backendsAdded,
      backendsLinked: result.backendsLinked,
      importedAt: new Date().toISOString(),
    };
  }

  const nextIaJson = JSON.stringify({
    ...iaCfg,
    platform: iaCfg.platform ?? 'elevenlabs',
    convaiBackendToolTaskIds: nextConvaiIds,
    ...(options?.fromFlowDrop
      ? {
          elevenLabsWorkflowNodeId: node.id,
          ...(recap ? { elevenLabsImportRecap: recap } : {}),
        }
      : {}),
  });

  const taskPatch: Partial<Task> = {
    agentDesignDescription: nextDescription,
    agentProposedFields: proposedFields,
    agentIaRuntimeOverrideJson: nextIaJson,
  };

  if (options?.fromFlowDrop) {
    taskPatch.agentWizardTutorAcknowledged = true;
    taskPatch.agentWizardCurrentStep = AGENT_WIZARD_FIRST_STEP_INDEX;
    if (hasImportedContent) {
      taskPatch.agentDesignHasGeneration = true;
    }
  }

  taskRepository.updateTask(taskInstanceId, taskPatch);

  document.dispatchEvent(
    new CustomEvent(OMNIA_AI_AGENT_REHYDRATE_FROM_REPO, {
      bubbles: true,
      detail: { taskId: taskInstanceId },
    })
  );

  return {
    promptApplied: result.promptApplied,
    variableNames: result.variableNames,
    backendsAdded: result.backendsAdded,
    backendsLinked: result.backendsLinked,
  };
}
