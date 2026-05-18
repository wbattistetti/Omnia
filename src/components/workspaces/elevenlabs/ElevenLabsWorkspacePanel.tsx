/**
 * Workspace ElevenLabs: workflow mirror, node inspector, optional import into an AI Agent task.
 */

import React from 'react';
import { Bot, Loader2, RefreshCw } from 'lucide-react';
import { ensureWorkspacesBootstrapped, getWorkspaceProvider, ELEVENLABS_WORKSPACE_PROVIDER_ID } from '@workspaces/index';
import type { WorkspaceAgentSnapshot } from '@workspaces/core/types';
import { remoteAgentRef } from '@workspaces/core/WorkspaceProvider';
import { importElevenLabsNodeToOmnia } from '@workspaces/elevenlabs/importElevenLabsNodeToOmnia';
import { persistElevenLabsImportToTask } from '@workspaces/elevenlabs/persistElevenLabsImportToTask';
import { writeElevenLabsNodeDragData } from '@workspaces/elevenlabs/elevenLabsDragPayload';
import {
  getElevenLabsWorkspaceSession,
  setElevenLabsWorkspaceSession,
} from '@workspaces/elevenlabs/elevenLabsWorkspaceSessionCache';
import {
  applyWorkflowCanvasLocalPatch,
  EMPTY_WORKFLOW_CANVAS_PATCH,
  type WorkflowCanvasLocalPatch,
} from '@workspaces/elevenlabs/workflowCanvasLocalPatch';
import {
  mergeWorkflowPositionOverrides,
  type WorkflowPositionOverrides,
} from '@workspaces/elevenlabs/workflowLayoutPositions';
import { appendAuditEntry } from '../../../application/backendCatalog/appendOnlyAuditLog';
import { useProjectData, useProjectDataUpdate } from '@context/ProjectDataContext';
import { setConvaiSessionBinding } from '@utils/iaAgentRuntime/convaiSessionAgentStore';
import { buildConvaiProvisionKey } from '@utils/iaAgentRuntime/convaiAgentCreatePayload';
import { taskRepository } from '@services/TaskRepository';
import { useOptionalAIAgentEditorDock } from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/AIAgentEditorDockContext';
import { ElevenLabsNodeInspector } from './ElevenLabsNodeInspector';
import { ElevenLabsAgentSettingsPanel } from './ElevenLabsAgentSettingsPanel';
import { ElevenLabsWebhooksPanel } from './ElevenLabsWebhooksPanel';
import { ElevenLabsWorkflowCanvas } from './ElevenLabsWorkflowCanvas';
import { ElevenLabsWorkflowSplitLayout } from './ElevenLabsWorkflowSplitLayout';
import { ELEVENLABS_WORKSPACE_TABS, type ElevenLabsWorkspaceTab } from './elevenLabsWorkspaceTabs';
import { useElevenLabsKbWorkspace } from '@workspaces/elevenlabs/useElevenLabsStagedNodeFiles';
import { getKbWorkspacePersist } from '@workspaces/elevenlabs/kbWorkspacePersist';

export type ElevenLabsWorkspacePanelProps = {
  /** Remote ConvAI agent id (required in dock tab mode). */
  agentId: string;
  agentName?: string;
  /** Enables import into this task via repository when the editor is not mounted. */
  linkedTaskInstanceId?: string;
  /** When true, show remote agent picker (legacy / embedded). Default false if `agentId` is set. */
  showAgentPicker?: boolean;
  onAfterImport?: () => void;
};

export function ElevenLabsWorkspacePanel({
  agentId: lockedAgentId,
  agentName: lockedAgentName,
  linkedTaskInstanceId,
  showAgentPicker = false,
  onAfterImport,
}: ElevenLabsWorkspacePanelProps): React.ReactElement {
  ensureWorkspacesBootstrapped();
  const provider = getWorkspaceProvider(ELEVENLABS_WORKSPACE_PROVIDER_ID);
  const dock = useOptionalAIAgentEditorDock();
  const { data: projectData } = useProjectData();
  const { updateDataDirectly } = useProjectDataUpdate();

  const [agents, setAgents] = React.useState<readonly { agentId: string; name: string }[]>([]);
  const [pickerAgentId, setPickerAgentId] = React.useState('');
  const [snapshot, setSnapshot] = React.useState<WorkspaceAgentSnapshot | null>(null);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [listLoading, setListLoading] = React.useState(false);
  const [agentLoading, setAgentLoading] = React.useState(false);
  const [importBusy, setImportBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [importMessage, setImportMessage] = React.useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = React.useState<ElevenLabsWorkspaceTab>('workflow');
  const [nodePositionOverrides, setNodePositionOverrides] = React.useState<WorkflowPositionOverrides>({});
  const [workflowCanvasPatch, setWorkflowCanvasPatch] =
    React.useState<WorkflowCanvasLocalPatch>(EMPTY_WORKFLOW_CANVAS_PATCH);
  const resolvedAgentId = (showAgentPicker ? pickerAgentId : lockedAgentId).trim();
  const {
    getStaged,
    getStagedKb,
    addStaged,
    addKbFiles,
    removeStaged,
    updateKbDoc,
    agentSystemPromptMarkdown,
    setAgentSystemPromptMarkdown,
    collectAllKbSnippets,
  } = useElevenLabsKbWorkspace(projectData?.id, resolvedAgentId);
  const displayAgentName =
    lockedAgentName?.trim() ||
    agents.find((a) => a.agentId === resolvedAgentId)?.name?.trim() ||
    snapshot?.ref.name?.trim() ||
    '';

  const loadAgentList = React.useCallback(async () => {
    if (!provider || !showAgentPicker) return;
    setListLoading(true);
    setError(null);
    try {
      const page = await provider.listAgents({ pageSize: 50 });
      setAgents(page.agents);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setListLoading(false);
    }
  }, [provider, showAgentPicker]);

  const applySnapshot = React.useCallback(
    (
      snap: WorkspaceAgentSnapshot,
      preferNodeId: string | null,
      opts?: { resetCanvasPatch?: boolean }
    ) => {
      setSnapshot(snap);
      const first =
        preferNodeId ??
        snap.workflow.nodes.find((n) => n.kind === 'subagent')?.id ??
        snap.workflow.nodes[0]?.id ??
        null;
      setSelectedNodeId(first);
      const patchForSession =
        opts?.resetCanvasPatch === false ? workflowCanvasPatch : EMPTY_WORKFLOW_CANVAS_PATCH;
      if (opts?.resetCanvasPatch !== false) {
        setWorkflowCanvasPatch(EMPTY_WORKFLOW_CANVAS_PATCH);
      }
      setElevenLabsWorkspaceSession(projectData?.id, snap.ref.agentId, {
        snapshot: snap,
        selectedNodeId: first,
        workspaceTab,
        nodePositionOverrides,
        workflowCanvasPatch: patchForSession,
      });
    },
    [projectData?.id, workspaceTab, nodePositionOverrides, workflowCanvasPatch]
  );

  const loadAgentDetail = React.useCallback(
    async (id: string, opts?: { forceNetwork?: boolean }) => {
      if (!provider || !id.trim()) return;
      const pid = projectData?.id;
      if (!opts?.forceNetwork) {
        const cached = getElevenLabsWorkspaceSession(pid, id);
        if (cached?.snapshot?.ref.agentId === id) {
          setNodePositionOverrides(cached.nodePositionOverrides ?? {});
          setWorkflowCanvasPatch(cached.workflowCanvasPatch ?? EMPTY_WORKFLOW_CANVAS_PATCH);
          applySnapshot(cached.snapshot, cached.selectedNodeId, { resetCanvasPatch: false });
          setWorkspaceTab(cached.workspaceTab);
          return;
        }
      }
      setAgentLoading(true);
      setError(null);
      setImportMessage(null);
      if (opts?.forceNetwork) {
        setNodePositionOverrides({});
        setWorkflowCanvasPatch(EMPTY_WORKFLOW_CANVAS_PATCH);
      }
      try {
        const snap = await provider.getAgent(remoteAgentRef(ELEVENLABS_WORKSPACE_PROVIDER_ID, id));
        applySnapshot(snap, null);

        const linkTaskId = linkedTaskInstanceId?.trim();
        if (linkTaskId) {
          const task = taskRepository.getTask(linkTaskId);
          let provisionKey = id;
          try {
            if (dock?.iaRuntimeConfig) {
              provisionKey = buildConvaiProvisionKey(dock.iaRuntimeConfig, task ?? undefined, false);
            }
          } catch {
            provisionKey = id;
          }
          setConvaiSessionBinding(linkTaskId, id, provisionKey);
          dock?.persistIaRuntimeOverrideSnapshot?.({
            platform: 'elevenlabs',
            convaiAgentId: id,
          });
        }
      } catch (e) {
        setSnapshot(null);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setAgentLoading(false);
      }
    },
    [provider, linkedTaskInstanceId, dock, projectData?.id, applySnapshot]
  );

  React.useEffect(() => {
    if (!snapshot?.ref.agentId || !projectData?.id) return;
    setElevenLabsWorkspaceSession(projectData.id, snapshot.ref.agentId, {
      snapshot,
      selectedNodeId,
      workspaceTab,
      nodePositionOverrides,
      workflowCanvasPatch,
    });
  }, [snapshot, selectedNodeId, workspaceTab, projectData?.id, nodePositionOverrides, workflowCanvasPatch]);

  React.useEffect(() => {
    if (showAgentPicker) void loadAgentList();
  }, [showAgentPicker, loadAgentList]);

  React.useEffect(() => {
    if (!resolvedAgentId) return;
    if (snapshot?.ref.agentId === resolvedAgentId) return;
    void loadAgentDetail(resolvedAgentId);
  }, [resolvedAgentId, snapshot?.ref.agentId, loadAgentDetail]);

  React.useEffect(() => {
    if (!snapshot || snapshot.ref.agentId !== resolvedAgentId) return;
    const persisted = getKbWorkspacePersist(projectData?.id, resolvedAgentId);
    if (persisted.agentSystemPromptMarkdown.trim()) return;
    const remote = snapshot.settings.globalPrompt?.trim();
    if (remote) setAgentSystemPromptMarkdown(remote);
  }, [snapshot, resolvedAgentId, projectData?.id, setAgentSystemPromptMarkdown]);

  const collectKbSnippets = React.useCallback(() => {
    if (!snapshot) return [];
    const nodeLabelsById: Record<string, string> = {};
    for (const n of snapshot.workflow.nodes) {
      nodeLabelsById[n.id] = n.label?.trim() || n.id;
    }
    return collectAllKbSnippets(nodeLabelsById);
  }, [snapshot, collectAllKbSnippets]);

  const displayWorkflow = React.useMemo(() => {
    if (!snapshot) return null;
    const withPositions = mergeWorkflowPositionOverrides(snapshot.workflow, nodePositionOverrides);
    return applyWorkflowCanvasLocalPatch(withPositions, workflowCanvasPatch);
  }, [snapshot, nodePositionOverrides, workflowCanvasPatch]);

  const selectedNode =
    displayWorkflow?.nodes.find((n) => n.id === selectedNodeId) ?? null;

  const formatImportResult = React.useCallback(
    (result: {
      promptApplied: boolean;
      variableNames: readonly string[];
      backendsAdded: number;
      backendsLinked: number;
    }) => {
      const parts: string[] = [];
      if (result.promptApplied) parts.push('system prompt in Descrizione');
      if (result.variableNames.length > 0) {
        parts.push(`${result.variableNames.length} variabili in Dati`);
      }
      if (result.backendsAdded > 0) {
        parts.push(`${result.backendsAdded} backend nuovi`);
      } else if (result.backendsLinked > 0) {
        parts.push(`${result.backendsLinked} backend collegati`);
      }
      return parts.length > 0 ? `Importato: ${parts.join(', ')}.` : 'Nessun contenuto da importare.';
    },
    []
  );

  const runImportForNode = React.useCallback(
    (nodeId: string) => {
      const node = snapshot?.workflow.nodes.find((n) => n.id === nodeId);
      if (!node || !snapshot) return;
      setSelectedNodeId(nodeId);
      setImportBusy(true);
      setImportMessage(null);
      try {
        const agentName = displayAgentName || snapshot.ref.name || '';
        const linkId = linkedTaskInstanceId?.trim();
        const liveDock = dock && linkId && dock.instanceId === linkId ? dock : null;
        const catalog = projectData?.backendCatalog;
        const prevManual = catalog?.manualEntries ?? [];

        if (liveDock) {
          let nextManual = [...prevManual];
          const result = importElevenLabsNodeToOmnia({
            node,
            agentName,
            settings: snapshot.settings,
            toolInventory: snapshot.toolInventory,
            targets: {
              designDescription: liveDock.designDescription,
              setDesignDescription: liveDock.setDesignDescription,
              proposedFields: liveDock.proposedFields,
              onUpdateProposedField: liveDock.onUpdateProposedField,
              addProposedFields: liveDock.appendProposedFields,
            },
            backends: {
              projectId: liveDock.projectId ?? projectData?.id,
              manualEntries: prevManual,
              setManualEntries: (entries) => {
                nextManual = entries;
              },
              convaiBackendToolTaskIds: liveDock.iaRuntimeConfig?.convaiBackendToolTaskIds ?? [],
              setConvaiBackendToolTaskIds: (ids) => {
                liveDock.persistIaRuntimeOverrideSnapshot({
                  convaiBackendToolTaskIds: ids,
                });
              },
            },
          });
          if (projectData && nextManual !== prevManual) {
            const auditLog = appendAuditEntry(catalog?.auditLog ?? [], {
              projectId: projectData.id ?? '',
              kind: 'manual_catalog_crud',
              payload: { op: 'elevenlabs_import', nodeId: node.id, added: result.backendsAdded },
            });
            updateDataDirectly({
              ...projectData,
              backendCatalog: {
                schemaVersion: 1,
                manualEntries: nextManual,
                auditLog,
                catalogVersion: (catalog?.catalogVersion ?? 0) + 1,
              },
            });
          }
          setImportMessage(formatImportResult(result));
          onAfterImport?.();
        } else if (linkId) {
          const result = persistElevenLabsImportToTask(
            linkId,
            node,
            agentName,
            snapshot.settings,
            snapshot.toolInventory
          );
          const pd = (window as { __projectData?: typeof projectData }).__projectData;
          if (pd) updateDataDirectly(pd);
          setImportMessage(formatImportResult(result));
          onAfterImport?.();
        } else {
          setImportMessage(
            'Trascina il nodo (⋮⋮) sul canvas Omnia sotto, oppure apri l\'editor di un task Agente AI collegato.'
          );
        }
      } catch (e) {
        setImportMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setImportBusy(false);
      }
    },
    [
      snapshot,
      displayAgentName,
      linkedTaskInstanceId,
      dock,
      projectData,
      updateDataDirectly,
      formatImportResult,
      onAfterImport,
    ]
  );

  const handleImport = React.useCallback(() => {
    if (!selectedNodeId) return;
    runImportForNode(selectedNodeId);
  }, [selectedNodeId, runImportForNode]);

  const handleDragToOmniaFlow = React.useCallback(
    (nodeId: string, dataTransfer: DataTransfer) => {
      if (!snapshot) return;
      const node = snapshot.workflow.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      writeElevenLabsNodeDragData(dataTransfer, {
        remoteAgentId: snapshot.ref.agentId,
        remoteAgentName: displayAgentName || snapshot.ref.name || '',
        node,
        snapshot,
      });
    },
    [snapshot, displayAgentName]
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950/90">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <Bot className="h-4 w-4 text-violet-400" aria-hidden />
        <span className="text-sm font-semibold text-violet-100">Workspace ElevenLabs</span>
        {showAgentPicker ? (
          <>
            <select
              className="min-w-[12rem] max-w-full flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              value={resolvedAgentId}
              disabled={listLoading || agentLoading}
              onChange={(e) => {
                setPickerAgentId(e.target.value);
                setSnapshot(null);
                setNodePositionOverrides({});
                if (e.target.value) void loadAgentDetail(e.target.value);
              }}
            >
              <option value="">— Seleziona agente remoto —</option>
              {agents.map((a) => (
                <option key={a.agentId} value={a.agentId}>
                  {a.name?.trim() || a.agentId}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Aggiorna lista agenti"
              disabled={listLoading}
              onClick={() => void loadAgentList()}
              className="rounded border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              {listLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
            </button>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
            {displayAgentName || resolvedAgentId}
          </span>
        )}
        <button
          type="button"
          title="Ricarica agente"
          disabled={!resolvedAgentId || agentLoading}
          onClick={() => resolvedAgentId && void loadAgentDetail(resolvedAgentId, { forceNetwork: true })}
          className="rounded border border-slate-600 p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {agentLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
        </button>
        {agentLoading ? (
          <span className="text-xs text-slate-400">Caricamento agente…</span>
        ) : null}
      </header>
      {error ? (
        <p className="shrink-0 border-b border-rose-900/50 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}
      {importMessage ? (
        <p className="shrink-0 border-b border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          {importMessage}
        </p>
      ) : null}
      {snapshot &&
      snapshot.workflow.nodes.length > 0 &&
      !snapshot.workflow.nodes.some((n) => n.kind === 'subagent' || n.kind === 'tool') ? (
        <p className="shrink-0 border-b border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-100/90">
          L&apos;API ha restituito {snapshot.workflow.nodes.length} nodo/i (es. solo Inizio). Se nel portale
          ElevenLabs vedi più passi, salva il workflow lì e usa il pulsante Aggiorna qui.
        </p>
      ) : null}
      <div className="flex shrink-0 border-b border-slate-800 px-3" role="tablist">
        {ELEVENLABS_WORKSPACE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={workspaceTab === t.id}
            onClick={() => setWorkspaceTab(t.id)}
            className={
              'border-b-2 px-4 py-2.5 text-sm font-medium ' +
              (workspaceTab === t.id
                ? 'border-violet-400 text-violet-100'
                : 'border-transparent text-slate-400 hover:text-slate-200')
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      {snapshot && workspaceTab === 'agent' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ElevenLabsAgentSettingsPanel
            settings={snapshot.settings}
            agentName={displayAgentName}
            agentId={resolvedAgentId}
            toolInventory={snapshot.toolInventory}
            systemPromptMarkdown={agentSystemPromptMarkdown}
            onSystemPromptChange={setAgentSystemPromptMarkdown}
            collectKbSnippets={collectKbSnippets}
            remoteGlobalPrompt={snapshot.settings.globalPrompt}
            projectData={projectData}
            projectId={projectData?.id}
            updateProjectData={updateDataDirectly}
          />
        </div>
      ) : null}
      {snapshot && workspaceTab === 'webhooks' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ElevenLabsWebhooksPanel
            toolInventory={snapshot.toolInventory}
            agentId={resolvedAgentId}
            projectData={projectData}
            projectId={projectData?.id}
            updateProjectData={updateDataDirectly}
          />
        </div>
      ) : null}
      {workspaceTab === 'workflow' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <ElevenLabsWorkflowSplitLayout
          canvas={
            snapshot ? (
              <ElevenLabsWorkflowCanvas
                graph={snapshot.workflow}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onDragToOmniaFlow={handleDragToOmniaFlow}
                positionOverrides={nodePositionOverrides}
                onPositionOverridesChange={setNodePositionOverrides}
                workflowCanvasPatch={workflowCanvasPatch}
                onWorkflowCanvasPatchChange={setWorkflowCanvasPatch}
                globalPrompt={snapshot.settings.globalPrompt}
              />
            ) : (
              <p className="p-4 text-xs text-slate-500">
                {resolvedAgentId
                  ? 'Caricamento workflow…'
                  : 'Seleziona un agente per visualizzare il workflow.'}
              </p>
            )
          }
          inspector={
            <ElevenLabsNodeInspector
              node={selectedNode}
              globalPrompt={snapshot?.globalPrompt}
              agentSettings={snapshot?.settings}
              toolInventory={snapshot?.toolInventory}
              onOpenAgentTab={() => setWorkspaceTab('agent')}
              onImportNode={selectedNode ? handleImport : undefined}
              importBusy={importBusy}
              stagedKbDocuments={selectedNode ? getStagedKb(selectedNode.id) : []}
              onAddKbFiles={
                selectedNode ? (files) => addKbFiles(selectedNode.id, files) : undefined
              }
              onRemoveStagedKbFile={
                selectedNode ? (fileId) => removeStaged(selectedNode.id, 'kb', fileId) : undefined
              }
              onUpdateKbDoc={
                selectedNode
                  ? (docId, patch) => updateKbDoc(selectedNode.id, docId, patch)
                  : undefined
              }
              projectId={projectData?.id}
              kbCallMeta={{ purpose: 'EL_KB_DOCUMENT_SEMANTIC', taskId: resolvedAgentId }}
              stagedToolFiles={selectedNode ? getStaged(selectedNode.id, 'tools') : []}
              onAddToolFiles={
                selectedNode ? (files) => addStaged(selectedNode.id, 'tools', files) : undefined
              }
              onRemoveStagedToolFile={
                selectedNode
                  ? (fileId) => removeStaged(selectedNode.id, 'tools', fileId)
                  : undefined
              }
              systemPromptMarkdown={agentSystemPromptMarkdown}
              onSystemPromptChange={setAgentSystemPromptMarkdown}
              collectKbSnippets={collectKbSnippets}
              agentId={resolvedAgentId}
              projectData={projectData}
              projectId={projectData?.id}
              updateProjectData={updateDataDirectly}
            />
          }
        />
        </div>
      ) : null}
    </div>
  );
}
