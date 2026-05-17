/**
 * CRUD su `project.backendCatalog.manualEntries` per tool webhook draft nel workspace ElevenLabs.
 */

import React from 'react';
import type { ProjectData } from '@types/project';
import type {
  ElevenLabsWorkspaceToolKind,
  ManualCatalogEntry,
} from '@domain/backendCatalog/catalogTypes';
import { appendAuditEntry } from '../../application/backendCatalog/appendOnlyAuditLog';
import { generateSafeGuid } from '@utils/idGenerator';
import { ensureManualCatalogBackendTask } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/ensureManualCatalogBackendTask';
import { filterElevenLabsWorkspaceEntries } from './elevenLabsWorkspaceCatalog';

export type ElevenLabsWorkspaceCatalogScope = {
  scope: 'agent' | 'node';
  nodeId?: string;
  agentId?: string;
};

export function useElevenLabsWorkspaceCatalog(
  projectData: ProjectData | null | undefined,
  updateDataDirectly: ((data: ProjectData) => void) | undefined,
  projectId: string | undefined,
  catalogScope: ElevenLabsWorkspaceCatalogScope
) {
  const mergeCatalog = React.useCallback(
    (mutate: (entries: ManualCatalogEntry[]) => ManualCatalogEntry[]) => {
      if (!projectData || !updateDataDirectly) return;
      const catalog = projectData.backendCatalog;
      const prev = catalog?.manualEntries ?? [];
      const next = mutate([...prev]);
      if (next === prev) return;
      const auditLog = appendAuditEntry(catalog?.auditLog ?? [], {
        projectId: projectData.id ?? '',
        kind: 'manual_catalog_crud',
        payload: { op: 'elevenlabs_workspace_tool', scope: catalogScope.scope },
      });
      updateDataDirectly({
        ...projectData,
        backendCatalog: {
          schemaVersion: 1,
          manualEntries: next,
          auditLog,
          catalogVersion: (catalog?.catalogVersion ?? 0) + 1,
        },
      });
    },
    [catalogScope.scope, projectData, updateDataDirectly]
  );

  const workspaceEntries = React.useMemo(() => {
    const all = projectData?.backendCatalog?.manualEntries ?? [];
    return filterElevenLabsWorkspaceEntries(all, {
      kind: 'webhook',
      scope: catalogScope.scope,
      nodeId: catalogScope.nodeId,
      agentId: catalogScope.agentId,
    });
  }, [
    catalogScope.agentId,
    catalogScope.nodeId,
    catalogScope.scope,
    projectData?.backendCatalog?.manualEntries,
  ]);

  const patchEntry = React.useCallback(
    (id: string, patch: Partial<ManualCatalogEntry>) => {
      mergeCatalog((entries) =>
        entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
    },
    [mergeCatalog]
  );

  const removeEntry = React.useCallback(
    (id: string) => {
      mergeCatalog((entries) => entries.filter((e) => e.id !== id));
    },
    [mergeCatalog]
  );

  const addWebhookTool = React.useCallback((): string | null => {
    if (!projectData || !updateDataDirectly) return null;
    const id = generateSafeGuid();
    const now = new Date().toISOString();
    const entry: ManualCatalogEntry = {
      id,
      label: '',
      method: 'POST',
      endpointUrl: '',
      creationMode: 'import',
      importSpecRevealed: false,
      frozenMeta: {
        lastImportedAt: null,
        specSourceUrl: null,
        contentHash: null,
        importState: 'none',
      },
      lastStructuralEditAt: now,
      elevenLabsWorkspaceTool: {
        kind: 'webhook',
        scope: catalogScope.scope,
        ...(catalogScope.nodeId ? { nodeId: catalogScope.nodeId } : {}),
        ...(catalogScope.agentId ? { agentId: catalogScope.agentId } : {}),
      },
    };
    mergeCatalog((entries) => [...entries, entry]);
    ensureManualCatalogBackendTask(entry, projectId);
    return id;
  }, [catalogScope, mergeCatalog, projectData, projectId, updateDataDirectly]);

  /** Placeholder per Client / Integrazione (fase successiva). */
  const addToolKind = React.useCallback(
    (kind: ElevenLabsWorkspaceToolKind): string | null => {
      if (kind !== 'webhook') return null;
      return addWebhookTool();
    },
    [addWebhookTool]
  );

  return {
    canEdit: Boolean(projectData && updateDataDirectly),
    workspaceEntries,
    patchEntry,
    removeEntry,
    addWebhookTool,
    addToolKind,
  };
}
