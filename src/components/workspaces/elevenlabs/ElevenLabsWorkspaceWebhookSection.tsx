/**
 * Sezione workspace: droplist «Aggiungi strumento» + accordion webhook (catalogo + Backend Call task).
 */

import React from 'react';
import type { ProjectData } from '@types/project';
import type { ElevenLabsWorkspaceToolKind } from '@domain/backendCatalog/catalogTypes';
import type { PortalConnectionMeta } from '@domain/portalAuth/portalConnectionTypes';
import { upsertProjectPortalConnection } from '@domain/portalAuth/projectPortalConnections';
import { ManualBackendAccordion } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/EditorBackendsPanel';
import { ConnectPortalModal } from '@components/portalAuth/ConnectPortalModal';
import {
  useElevenLabsWorkspaceCatalog,
  type ElevenLabsWorkspaceCatalogScope,
} from '@workspaces/elevenlabs/useElevenLabsWorkspaceCatalog';
import { AddConvaiToolDropdown } from './AddConvaiToolDropdown';

export type ElevenLabsWorkspaceWebhookSectionProps = {
  projectData: ProjectData | null | undefined;
  projectId: string | undefined;
  updateDataDirectly: ((data: ProjectData) => void) | undefined;
  catalogScope: ElevenLabsWorkspaceCatalogScope;
  /** Allinea il droplist a destra (toolbar riga). */
  alignDropdownEnd?: boolean;
};

export function ElevenLabsWorkspaceWebhookSection({
  projectData,
  projectId,
  updateDataDirectly,
  catalogScope,
  alignDropdownEnd = false,
}: ElevenLabsWorkspaceWebhookSectionProps): React.ReactElement {
  const { canEdit, workspaceEntries, patchEntry, removeEntry, addToolKind } =
    useElevenLabsWorkspaceCatalog(projectData, updateDataDirectly, projectId, catalogScope);

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [focusNameEntryId, setFocusNameEntryId] = React.useState<string | null>(null);
  const [portalModal, setPortalModal] = React.useState<{ open: boolean; origin: string }>({
    open: false,
    origin: '',
  });
  const pendingPortalEntryRef = React.useRef<string | null>(null);
  const [autoFetchAfterPortalEntryId, setAutoFetchAfterPortalEntryId] = React.useState<
    string | null
  >(null);

  const mergePortalConnections = React.useCallback(
    (meta: PortalConnectionMeta) => {
      if (!projectData || !updateDataDirectly) return;
      updateDataDirectly(upsertProjectPortalConnection(projectData, meta));
    },
    [projectData, updateDataDirectly]
  );

  const handlePortalAuthRequired = React.useCallback((origin: string, entryId: string) => {
    pendingPortalEntryRef.current = entryId;
    setPortalModal({ open: true, origin });
  }, []);

  const handlePortalConnected = React.useCallback((meta: PortalConnectionMeta) => {
    mergePortalConnections(meta);
    const entryId = pendingPortalEntryRef.current;
    pendingPortalEntryRef.current = null;
    setPortalModal({ open: false, origin: '' });
    if (entryId) setAutoFetchAfterPortalEntryId(entryId);
  }, [mergePortalConnections]);

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const handleSelectKind = React.useCallback(
    (kind: ElevenLabsWorkspaceToolKind) => {
      if (kind === 'client' || kind === 'integration') {
        return;
      }
      const id = addToolKind(kind);
      if (!id) return;
      setExpandedIds((s) => new Set(s).add(id));
    },
    [addToolKind]
  );

  if (!canEdit) {
    return (
      <p className="text-[11px] text-slate-500">
        Apri un progetto Omnia per aggiungere webhook draft nel catalogo backend.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className={`flex ${alignDropdownEnd ? 'justify-end' : ''}`}>
        <AddConvaiToolDropdown disabled={!canEdit} onSelectKind={handleSelectKind} />
      </div>

      {workspaceEntries.length > 0 ? (
        <ul className="space-y-2">
          {workspaceEntries.map((entry) => (
            <li key={entry.id}>
              <ManualBackendAccordion
                entry={entry}
                expanded={expandedIds.has(entry.id)}
                projectId={projectId}
                projectData={projectData}
                creationMode="import"
                embedInWorkspaceInspector
                onToggle={() => toggleExpanded(entry.id)}
                onPatch={patchEntry}
                onRemove={removeEntry}
                onExpandEntry={(id) => setExpandedIds((s) => new Set(s).add(id))}
                onPortalAuthRequired={handlePortalAuthRequired}
                onSyncPortalConnection={mergePortalConnections}
                autoFetchAfterPortalEntryId={autoFetchAfterPortalEntryId}
                onAutoFetchConsumed={() => setAutoFetchAfterPortalEntryId(null)}
                focusName={focusNameEntryId === entry.id}
                onNameFocused={() => setFocusNameEntryId(null)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {projectId ? (
        <ConnectPortalModal
          open={portalModal.open}
          origin={portalModal.origin}
          projectId={projectId}
          onClose={() => {
            pendingPortalEntryRef.current = null;
            setPortalModal({ open: false, origin: '' });
          }}
          onConnected={handlePortalConnected}
        />
      ) : null}
    </div>
  );
}
