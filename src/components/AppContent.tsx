import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { LandingPage } from './LandingPage';
import { Toolbar } from './Toolbar';
import { GlobalProjectDataPanel } from './GlobalProjectDataPanel';
import { useFontClasses } from '../hooks/useFontClasses';
import { NewProjectModal } from './NewProjectModal';
import Sidebar from './Sidebar/Sidebar';
import { ProjectDataService } from '../services/ProjectDataService';
import { useProjectData, useProjectDataUpdate } from '../context/ProjectDataContext';
import { useProjectTranslations } from '../context/ProjectTranslationsContext';
import { Node, Edge } from 'reactflow';
import { FlowNode, EdgeData } from './Flowchart/types/flowTypes';
import { ProjectInfo } from '../types/project';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { ProjectService } from '../services/ProjectService';
import { ProjectData } from '../types/project';
import { SidebarThemeProvider } from './Sidebar/SidebarThemeContext';
import { DockWorkspace } from './FlowWorkspace/DockWorkspace';
import { DockManager } from './Dock/DockManager';
import { DockNode, DockTab, DockTabResponseEditor, DockTabTaskEditor, DockTabChat, ToolbarButton } from '../dock/types'; // ✅ RINOMINATO: DockTabActEditor → DockTabTaskEditor
import { FlowWorkspaceProvider, useFlowWorkspace, useFlowActions } from '@flows/FlowStore';
import { upsertAddNextTo, closeTab, activateTab, upsertFlowTabInDualPane } from '../dock/ops';
import { createDefaultDockTree } from '../dock/projectWorkspaceUiSnapshot';
import { WorkspaceDockLifecycle } from '../dock/WorkspaceDockLifecycle';
import { findRootTabset, tabExists } from './AppContent/domain/dockTree';
import { openBottomDockedTab } from './AppContent/infrastructure/docking/DockingHelpers';
import { EditorCoordinator } from './AppContent/application/coordinators/EditorCoordinator';
// ✅ M1: Domain model mapper (introduced, not yet used - will be used in M2)
import { mapUIStateToDomain } from '../domain/project/mapper';
import { isAiAgentDebugEnabled, summarizeAgentTaskFields } from './TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentDebug';
import { flushAiAgentEditorsBeforeProjectSave } from './TaskEditor/EditorHost/editors/aiAgentEditor/aiAgentProjectSaveFlush';
// ✅ M5: Project save orchestrator (now with executeSave)
import {
  ProjectSaveOrchestrator,
  cloneWorkspaceFlowsSnapshot,
  buildFlowsByIdForOrchestrator,
  persistWorkspaceRestoreForProject,
  clearWorkspaceRestoreForProject,
} from '../services/project-save';
import { createProjectVersion } from '../services/createProjectVersion';
import { logFlowSaveDebug, summarizeWorkspaceFlowsForDebug } from '../utils/flowSaveDebug';
// ✅ REMOVED: Migration moved to DB script - keep codebase clean
// Migration should be a separate DB script, not executed during save
import { ProjectManager, isDraftProjectId } from './AppContent/application/services/ProjectManager';
import { TabRenderer } from './AppContent/presentation/TabRenderer';
import { resolveEditorKind } from './TaskEditor/EditorHost/resolveKind'; // ✅ RINOMINATO: ActEditor → TaskEditor
import BackendBuilderStudio from '../BackendBuilder/ui/Studio';
import { useChatOrchestrator } from '../hooks/useChatOrchestrator';
import { FlowWorkspaceSnapshot } from '../flows/FlowWorkspaceSnapshot';
import { resolveFlowTabDisplayTitle } from '@utils/resolveFlowTabDisplayTitle';
import { variableCreationService } from '../services/VariableCreationService';
import { logVariableHydration } from '../utils/variableMenuDebug';
import { buildFlowCanvasRowFingerprint } from '../utils/flowWorkspaceUtteranceFingerprint';
import { initializeErrorReportPanelService } from '../services/ErrorReportPanelService';
import ResizableResponseEditor from './TaskEditor/ResponseEditor/ResizableResponseEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import ResizableNonInteractiveEditor from './TaskEditor/ResponseEditor/ResizableNonInteractiveEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import ResizableTaskEditorHost from './TaskEditor/EditorHost/ResizableTaskEditorHost'; // ✅ RINOMINATO: ActEditor → TaskEditor, ResizableActEditorHost → ResizableTaskEditorHost
import { useTaskEditor } from './TaskEditor/EditorHost/TaskEditorContext'; // ✅ RINOMINATO: ActEditor → TaskEditor, useActEditor → useTaskEditor
import ConditionEditor from './conditions/ConditionEditor';
import DDEBubbleChat from './TaskEditor/ResponseEditor/ChatSimulator/DDEBubbleChat';
import type { Message } from '@components/ChatSimulator/UserMessage';
import { FontProvider } from '../context/FontContext';
import { useTaskTreeContext } from '../context/DDTContext';
import type { DebuggerRuntimeBridge } from '../features/useCases/runtime/DebuggerRuntimeBridge';
import type { UseCase, UseCaseRunResult, UseCaseRuntimePort } from '../features/useCases/model';
import { runUseCase } from '../features/useCases/runner/UseCaseRunner';
import { buildUseCaseFromDebuggerMessages } from '../features/useCases/debugger/debuggerUseCaseSnapshot';
import {
  moveUseCaseKeyToFolder,
  renameFolderPrefix,
  withUseCaseKey,
} from '../features/useCases/tree/useCaseTreeModel';
import { UseCaseEditorPanel } from '../features/useCases/ui/UseCaseEditorPanel';
import { UseCaseNoteManager } from '../features/useCases/notes/UseCaseNoteManager';
// ✅ REMOVED: Imports moved to handlers (SIDEBAR_TYPE_COLORS, flowchartVariablesService, getNodesWithFallback)
// FASE 2: InstanceRepository import removed - using TaskRepository instead
// TaskRepository automatically syncs with InstanceRepository for backward compatibility
import ResponseEditor from './TaskEditor/ResponseEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import NonInteractiveResponseEditor from './TaskEditor/ResponseEditor/NonInteractiveResponseEditor'; // ✅ RINOMINATO: ActEditor → TaskEditor
import { taskRepository } from '../services/TaskRepository';
import {
  setSubflowSyncFlows,
  setSubflowSyncTranslations,
  setSubflowSyncUpsertFlowSlice,
} from '../domain/taskSubflowMove/subflowSyncFlowsRef';
import { logUpsertFlowSliceInbound, logUpsertSubflowEmptyNodesCaller } from '../utils/flowStructuralCommitDiagnostic';
import { getActiveFlowCanvasId } from '../flows/activeFlowCanvas';
import { provisionParentVariablesForSubflowTaskAsync } from '../services/subflowOutputProvisioning';
import { getTemplateId } from '../utils/taskHelpers';
import { getNextMinor, getNextMajor, getLatestVersion, compareVersions } from '../utils/versionUtils';
import { TaskType } from '../types/taskTypes'; // ✅ RIMOSSO: taskIdToTaskType - non più necessario, le fonti emettono direttamente TaskType enum
import type { TaskMeta, TaskWizardMode } from './TaskEditor/EditorHost/types'; // ✅ RINOMINATO: ActEditor → TaskEditor
import type { TaskTree, Task } from '../types/taskTypes';

type AppState = 'landing' | 'creatingProject' | 'mainApp';

// Helper function to map over dock tree nodes
function mapNode(n: DockNode, f: (n: DockNode) => DockNode): DockNode {
  let mapped: DockNode;
  if (n.kind === 'split') {
    const children = n.children.map(c => mapNode(c, f));
    mapped = { ...n, children };
  } else {
    mapped = { ...n };
  }
  const res = f(mapped);
  return res;
}

function flowGraphSignature(flow: { id?: string; nodes?: any[]; edges?: any[] } | null | undefined): string {
  if (!flow) return 'none';
  const id = String(flow.id || '');
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow.edges) ? flow.edges : [];
  const nodeSig = nodes
    .map((n) => `${String(n?.id || '')}@${Number(n?.position?.x ?? 0)},${Number(n?.position?.y ?? 0)}`)
    .join('|');
  const edgeSig = edges
    .map((e) => `${String(e?.id || '')}:${String(e?.source || '')}>${String(e?.target || '')}`)
    .join('|');
  return `${id}#n${nodes.length}[${nodeSig}]#e${edges.length}[${edgeSig}]`;
}

// ✅ ARCHITECTURAL FIX: Component that accesses FlowWorkspaceProvider and populates flowsRef
// This allows handleSaveProject to access flows without using window.__flows
const DockManagerWithFlows: React.FC<{
  root: DockNode;
  setRoot: (updater: (prev: DockNode) => DockNode) => void;
  renderTabContent: (tab: DockTab, upsertFlow: (flow: { id: string; title: string; nodes: any[]; edges: any[] }) => void) => React.ReactNode;
  flowsRef: React.MutableRefObject<Record<string, any>>;
  editorCloseRefsMap: React.MutableRefObject<Map<string, () => Promise<boolean>>>;
  markFlowsPersistedRef: React.MutableRefObject<((flowIds: string[]) => void) | null>;
}> = ({ root, setRoot, renderTabContent, flowsRef, editorCloseRefsMap, markFlowsPersistedRef }) => {
  const projectDataCtx = useProjectData();
  const flowWorkspace = useFlowWorkspace<Node<FlowNode>, Edge<EdgeData>>();
  const flowActions = useFlowActions<Node<FlowNode>, Edge<EdgeData>>();
  const projectIdForMigration = projectDataCtx?.data?.id != null ? String(projectDataCtx.data.id).trim() : '';
  const subflowProxyMigrateKeyRef = React.useRef<string>('');
  const upsertFlowRef = useRef(flowActions.upsertFlow);
  const flowsSnapshotRef = useRef(flowWorkspace.flows);
  const lastInboundUpsertSignatureRef = useRef<string>('');
  upsertFlowRef.current = flowActions.upsertFlow;
  flowsSnapshotRef.current = flowWorkspace.flows;

  /**
   * Register FlowStore upsert **during render** so `upsertFlowSlicesFromSubflowSync` is never null
   * between first paint and useEffect (structural DnD runs synchronously on mouseup).
   */
  setSubflowSyncUpsertFlowSlice((f) => {
    logUpsertFlowSliceInbound('DockManager_subflowSync', f as any);
    const incoming = f as any;
    const flowId = String(incoming?.id || '').trim();
    if (!flowId) return;

    const current = (flowsSnapshotRef.current as any)?.[flowId];
    const currentSig = flowGraphSignature(current as any);
    const incomingSig = flowGraphSignature(incoming as any);
    const inboundSig = `${flowId}|${incomingSig}`;

    if (currentSig === incomingSig || lastInboundUpsertSignatureRef.current === inboundSig) {
      return;
    }
    lastInboundUpsertSignatureRef.current = inboundSig;
    upsertFlowRef.current(incoming);
  });

  /** Canvas row ids + inclusion flags — when this changes, re-hydrate utterance vars from TaskRepository. */
  const utteranceFlowHydrationFingerprint = React.useMemo(
    () => buildFlowCanvasRowFingerprint(flowWorkspace.flows as any),
    [flowWorkspace.flows]
  );

  React.useEffect(() => {
    const pid = projectIdForMigration;
    if (!pid) return;
    const flows = flowWorkspace.flows;
    if (!flows || Object.keys(flows).length === 0) return;
    logVariableHydration('DockManagerWithFlows:canvasSnapshot', {
      projectId: pid,
      flowIds: Object.keys(flows),
      fingerprint: utteranceFlowHydrationFingerprint.slice(0, 512),
    });
    if (import.meta.env.DEV) {
      console.info('[Omnia][DockManagerWithFlows] running hydrateVariablesFromFlow', {
        projectId: pid,
        flowIds: Object.keys(flows),
      });
    }
    variableCreationService.hydrateVariablesFromFlow(pid, flows as any);
    try {
      document.dispatchEvent(new CustomEvent('variableStore:updated', { bubbles: true }));
    } catch {
      /* noop */
    }
  }, [projectIdForMigration, utteranceFlowHydrationFingerprint]);

  // ✅ CRITICAL: Update flowsRef immediately (not just in useEffect)
  // This ensures flowsRef is always up-to-date when handleSaveProject is called
  flowsRef.current = flowWorkspace.flows;

  // ✅ Same-frame as React state: subflow sync + TaskRepository must not read stale graphs
  // (portal upsert → syncSubflowInterfaceAfterAuthoringCanvasChange in same tick used empty child).
  setSubflowSyncFlows(flowWorkspace.flows);

  // ✅ Same-frame: FlowWorkspaceSnapshot must match FlowStore before children render.
  // useEffect-only updates caused Interface OUTPUT / riepilogo to show raw GUIDs on first paint
  // (getActiveFlowMetaTranslationsFlattened read stale snapshot until effect ran).
  FlowWorkspaceSnapshot.setSnapshot(flowWorkspace.flows as any, flowWorkspace.activeFlowId);

  React.useEffect(() => {
    markFlowsPersistedRef.current = flowActions.markFlowsPersisted;
    return () => {
      markFlowsPersistedRef.current = null;
    };
  }, [flowActions.markFlowsPersisted]);

  /**
   * Legacy projects: child task variables may carry parent FQ names; parent proxies may be missing
   * or misaligned. Reconcile once per (project, flow-id-set) snapshot.
   */
  React.useEffect(() => {
    const pid = projectIdForMigration;
    if (!pid) return;
    const flows = flowWorkspace.flows;
    if (!flows || Object.keys(flows).length === 0) return;
    const flowKeys = Object.keys(flows).sort().join('\x1e');
    const key = `${pid}\x1e${flowKeys}`;
    if (subflowProxyMigrateKeyRef.current === key) return;

    let cancelled = false;
    void import('../domain/taskSubflowMove/subflowVariableProxyRestore').then(
      ({ migrateSubflowVariableProxyModel }) => {
        if (cancelled) return;
        try {
          const r = migrateSubflowVariableProxyModel(pid, flows as any);
          if (r.childRenames.length > 0 || r.syncCalls > 0) {
            console.log('[SubflowVariableProxyMigration]', { projectId: pid, ...r });
          }
          subflowProxyMigrateKeyRef.current = key;
        } catch (e) {
          console.warn('[SubflowVariableProxyMigration] failed', e);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [projectIdForMigration, flowWorkspace.flows]);

  useLayoutEffect(() => {
    return () => setSubflowSyncUpsertFlowSlice(null);
  }, []);

  // ✅ Adapt setRoot to match DockManager's expected signature
  const adaptedSetRoot = React.useCallback((n: DockNode | ((prev: DockNode) => DockNode)) => {
    if (typeof n === 'function') {
      setRoot(n);
    } else {
      setRoot(() => n);
    }
  }, [setRoot]);

  // ✅ Wrap renderTabContent to inject upsertFlow
  const wrappedRenderTabContent = React.useCallback(
    (tab: DockTab) => renderTabContent(tab, flowActions.upsertFlow),
    [renderTabContent, flowActions.upsertFlow]
  );

  const handleDockActiveTabChanged = React.useCallback((tab: DockTab) => {
    if (tab.type !== 'flow') return;
    const flowTab = tab as DockTab & { flowId?: string };
    const flowId = flowTab.flowId;
    if (!flowId) return;
    flowActions.setActiveFlow(flowId);
  }, [flowActions]);

  return (
    <DockManager
      root={root}
      setRoot={adaptedSetRoot}
      renderTabContent={wrappedRenderTabContent}
      editorCloseRefsMap={editorCloseRefsMap}
      onActiveTabChanged={handleDockActiveTabChanged}
    />
  );
};

interface AppContentProps {
  appState: AppState;
  setAppState: (state: AppState) => void;
  currentProject: ProjectData | null;
  setCurrentProject: (project: ProjectData | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  testPanelOpen: boolean;
  setTestPanelOpen: (open: boolean) => void;
  testNodeId: string | null;
  setTestNodeId: (id: string | null) => void;
  onPlayNode?: (nodeId: string) => void; // ✅ Optional: AppContent uses internal handleTestSingleNode
}

export const AppContent: React.FC<AppContentProps> = ({
  appState,
  setAppState,
  currentProject,
  setCurrentProject,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  testPanelOpen,
  setTestPanelOpen,
  testNodeId,
  setTestNodeId,
  onPlayNode
}) => {
  const pdUpdate = useProjectDataUpdate();
  const currentPid = (() => { try { return pdUpdate.getCurrentProjectId(); } catch { return undefined; } })();

  // Dock tree: main flow tabset only (per-flow Input/Output + Data è nel FlowVariablesRail laterale).
  const [dockTree, setDockTree] = useState<DockNode>(() => createDefaultDockTree());

  /** Reset dock when switching or closing project so tabs from project A never leak into B. */
  const prevProjectIdForDockRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const prev = prevProjectIdForDockRef.current;
    const cur = currentPid?.trim() || undefined;
    if (cur === undefined && prev !== undefined) {
      setDockTree(createDefaultDockTree());
    } else if (prev !== undefined && cur !== undefined && prev !== cur) {
      setDockTree(createDefaultDockTree());
    }
    prevProjectIdForDockRef.current = cur;
  }, [currentPid]);

  // ✅ Initialize ErrorReportPanelService
  React.useEffect(() => {
    initializeErrorReportPanelService(setDockTree);
  }, []);

  // ✅ REFACTOR: Map globale per tenere traccia di tutti i refs di chiusura per tutti i tab
  // Questo risolve il problema delle closure stale: quando tab.onClose viene chiamato,
  // legge sempre il valore più recente dal Map invece di una closure catturata
  const editorCloseRefsMap = React.useRef<Map<string, () => Promise<boolean>>>(new Map());

  // ✅ ARCHITECTURAL FIX: Ref per accedere ai flows dal FlowWorkspaceProvider
  // Popolato da DockManagerWithFlows che è dentro FlowWorkspaceProvider
  const flowsRef = React.useRef<Record<string, any>>({});

  /** Latest debugger regression use cases for inclusion in project save (ref avoids stale closure in runProjectSave). */
  const debuggerUseCasesRef = React.useRef<UseCase[]>([]);

  /** Opens global DDEBubbleChat for a specific flow id (dock toolbar Run); set after debugger state mounts. */
  const openGlobalDebuggerForFlowRef = React.useRef<(flowId: string) => void>(() => {});

  /** Step 3: reset hasLocalChanges after orchestrator persisted flows (set by DockManagerWithFlows). */
  const markFlowsPersistedRef = React.useRef<((flowIds: string[]) => void) | null>(null);

  // ✅ Get translations for chat panel (needed for ChatOrchestrator)
  const {
    translations: globalTranslations,
    compiledTranslations,
    isReady: translationsReady,
    isLoading: translationsLoading,
    loadAllTranslations,
  } = useProjectTranslations();

  React.useEffect(() => {
    setSubflowSyncTranslations(compiledTranslations || {});
  }, [compiledTranslations]);

  const chatOrchestrator = useChatOrchestrator({
    setDockTree,
    currentPid,
    translations: compiledTranslations,
    translationsReady,
    translationsLoading,
    loadAllTranslations,
  });

  const handleTestSingleNode = React.useCallback(async (nodeId: string, nodeRows?: any[]) => {
    console.log('[AppContent] handleTestSingleNode -> delegating to ChatOrchestrator');
    await chatOrchestrator.openSingleNodeChat(nodeId, nodeRows);
  }, [chatOrchestrator]);

  // ✅ REFACTOR: TabRenderer component estratto in presentation/TabRenderer.tsx
  // UnifiedTabContent completamente rimosso - ora usiamo TabRenderer

  // ✅ REFACTOR: Use TabRenderer component
  // Note: upsertFlow is now passed from DockManagerWithFlows to store task flow nodes/edges
  const renderTabContent = React.useCallback(
    (tab: DockTab, upsertFlow: (flow: { id: string; title: string; nodes: any[]; edges: any[] }) => void) => {
      return (
        <TabRenderer
          tab={tab}
          currentPid={currentPid}
          isDraft={Boolean(currentProject && isDraftProjectId(currentProject.id))}
          setDockTree={setDockTree}
          editorCloseRefsMap={editorCloseRefsMap}
          pdUpdate={pdUpdate}
          testSingleNode={handleTestSingleNode}
          onFlowCreateTaskFlow={(tabId, newFlowId, title, nodes, edges) => {
            // ✅ FIX: Store nodes/edges in FlowStore FIRST
            upsertFlow({ id: newFlowId, title: title || 'Task', nodes, edges });
            // THEN update the dock tree to add the new tab
            setDockTree(prev =>
              upsertAddNextTo(prev, tabId, {
                id: `tab_${newFlowId}`,
                title: title || 'Task',
                type: 'flow',
                flowId: newFlowId,
              })
            );
          }}
          onFlowOpenTaskFlow={(tabId, taskFlowId, title) => {
            // We just need to update the dock tree
            setDockTree(prev =>
              upsertAddNextTo(prev, tabId, {
                id: `tab_${taskFlowId}`,
                title: title || 'Task',
                type: 'flow',
                flowId: taskFlowId,
              })
            );
          }}
          onOpenSubflowForTask={(tabId, taskId, existingFlowId, title, canvasNodeId, sourceFlowId) => {
            const flowId = (existingFlowId && String(existingFlowId).trim())
              ? String(existingFlowId).trim()
              : `subflow_${taskId}`;
            const tabTitle = (title || '').trim() || 'Subflow';
            // Ensure a human-readable title is always propagated to FlowStore.
            // For existing subflows, preserve current graph and only refresh the title.
            const existingSlice = flowsRef.current?.[flowId];
            if (existingSlice) {
              upsertFlow({
                ...existingSlice,
                id: flowId,
                title: tabTitle,
              } as any);
            } else {
              const placeholder = {
                id: flowId,
                title: tabTitle,
                nodes: [],
                edges: [],
                hydrated: false,
                variablesReady: false,
                hasLocalChanges: false,
              } as any;
              logUpsertSubflowEmptyNodesCaller('AppContent:openSubflowTabPlaceholder', placeholder);
              upsertFlow(placeholder);
            }
            // Canonical: flowId in root; parameters = TaskDefinition array (never legacy object map).
            taskRepository.updateTask(taskId, {
              flowId,
              parameters: [],
            } as Partial<Task>);
            const pid = currentPid || '';
            if (pid) {
              const parentFlowId =
                String(sourceFlowId || '').trim() || getActiveFlowCanvasId();
              void provisionParentVariablesForSubflowTaskAsync(
                pid,
                parentFlowId,
                taskId,
                flowsRef.current as Record<string, unknown>
              );
            }
            setDockTree((prev) =>
              upsertFlowTabInDualPane(prev, tabId, {
                id: `tab_${flowId}`,
                title: tabTitle,
                type: 'flow',
                flowId,
              })
            );
            const fid = String(sourceFlowId || '').trim();
            const nid = String(canvasNodeId || '').trim();
            if (fid && nid) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  try {
                    document.dispatchEvent(
                      new CustomEvent('flowchart:centerViewportOnNode', {
                        bubbles: true,
                        detail: { flowId: fid, nodeId: nid },
                      })
                    );
                  } catch {
                    /* noop */
                  }
                });
              });
            }
          }}
          onRunFlowInDebugger={(flowId) => openGlobalDebuggerForFlowRef.current(flowId)}
        />
      );
    },
    [currentPid, currentProject, setDockTree, pdUpdate, handleTestSingleNode]
  );
  // Safe access: avoid calling context hook if provider not mounted (e.g., during hot reload glitches)
  let refreshData: () => Promise<void> = async () => { };
  try {
    const ctx = useProjectDataUpdate();
    refreshData = ctx.refreshData;
  } catch (e) {
    // Provider not available yet; use no-op and rely on provider after mount
    refreshData = async () => { };
  }
  // Access full project data for static variables extraction
  let projectData: any = null;
  try {
    projectData = useProjectData().data;
  } catch { }
  const taskTreeContext = useTaskTreeContext();
  const getTranslationsForTaskTree = taskTreeContext.getTranslationsForTaskTree;
  // const setTranslationsForTaskTree = taskTreeContext.setTranslationsForTaskTree;

  // Usa ActEditor context invece di selectedDDT per unificare l'apertura editor
  const taskEditorCtx = useTaskEditor(); // ✅ RINOMINATO: actEditorCtx → taskEditorCtx, useActEditor → useTaskEditor

  // ✅ REFACTOR: Initialize ProjectManager
  const projectManager = React.useMemo(() => {
    return new ProjectManager({
      pdUpdate,
      setCurrentProject,
      refreshData,
      setAppState,
    });
  }, [pdUpdate, setCurrentProject, refreshData, setAppState]);

  // Listen to open event for non-interactive acts (open as docking tab)
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      const instanceId = d.instanceId;

      // Read message text from Task (must exist)
      if (!instanceId) return;

      const task = taskRepository.getTask(instanceId);

      if (!task) {
        // Task doesn't exist, don't open editor
        return;
      }

      // ❌ RIMOSSO: const template = task.text || '' - task.text non deve esistere
      // TODO: Usare translations[textKey] dove textKey viene da task.parameters
      const template = '';

      // Open as docking tab instead of fixed panel
      const tabId = `ni_${instanceId}`;
      setDockTree(prev => {
        // ✅ REFACTOR: Use extracted domain function
        if (tabExists(prev, tabId)) return prev; // Already open, don't duplicate

        // Add next to active tab
        return upsertAddNextTo(prev, 'tab_main', {
          id: tabId,
          title: d.title || 'Agent message',
          type: 'nonInteractive',
          instanceId: instanceId,
          value: { template, samples: {}, vars: [] },
          accentColor: d.accentColor
        });
      });
    };
    document.addEventListener('nonInteractiveEditor:open', handler as any);
    return () => document.removeEventListener('nonInteractiveEditor:open', handler as any);
  }, []);

  // ✅ REFACTOR: Initialize EditorCoordinator
  const editorCoordinator = React.useMemo(() => {
    return new EditorCoordinator({
      currentProjectId: currentPid,
      projectData,
      pdUpdate,
    });
  }, [currentPid, projectData, pdUpdate]);

  /** Build create-version API payload from current project and overrides (name, version, etc.). */
  const buildCreateVersionPayload = React.useCallback(
    (overrides: { projectName?: string; version: string; versionQualifier?: string; clientName?: string | null }) => {
      if (!currentProject?.id) throw new Error('No project open');
      return {
        sourceProjectId: currentProject.id,
        projectName: overrides.projectName ?? (currentProject.name || ''),
        version: overrides.version,
        versionQualifier: overrides.versionQualifier ?? currentProject.versionQualifier ?? 'production',
        clientName: overrides.clientName ?? currentProject.clientName ?? null,
        ownerCompany: (currentProject as any).ownerCompany ?? null,
        ownerClient: (currentProject as any).ownerClient ?? null,
      };
    },
    [currentProject]
  );

  /**
   * Persist full project state (flows as FlowDocument, tasks, variables via orchestrator).
   * Throws on failure. Caller sets isCreatingProject and cloneError around this.
   * Does not list setIsCreatingProject in deps (useState setter is stable; it is declared below this callback).
   */
  const runProjectSave = React.useCallback(async (): Promise<void> => {
    let pid = pdUpdate.getCurrentProjectId();
    let flowsSnapshotBeforeDraftCommit: Record<string, unknown> | null = null;
    if (!pid && currentProject && isDraftProjectId(currentProject.id)) {
      flowsSnapshotBeforeDraftCommit = cloneWorkspaceFlowsSnapshot(
        flowsRef.current as Record<string, unknown> | undefined
      );
      logFlowSaveDebug('save: draft snapshot captured BEFORE commitDraftProject', {
        draftSnapshot: summarizeWorkspaceFlowsForDebug(flowsSnapshotBeforeDraftCommit),
      });
      try {
        pid = await projectManager.commitDraftProject(currentProject);
        if (pid && flowsSnapshotBeforeDraftCommit) {
          persistWorkspaceRestoreForProject(
            pid,
            flowsSnapshotBeforeDraftCommit as Record<string, unknown>
          );
        }
        await refreshData();
      } catch (e) {
        throw e instanceof Error ? e : new Error(String(e));
      } finally {
        setIsCreatingProject(false);
      }
      setIsCreatingProject(true);
    }
    if (!pid) {
      console.warn('[Save] No project ID available');
      throw new Error('No project ID available');
    }
    console.log('[Save] ═══════════════════════════════════════════════════════');
    console.log('[Save] 🚀 START SAVE PROJECT', { projectId: pid, timestamp: new Date().toISOString() });
    console.log('[Save] ═══════════════════════════════════════════════════════');

    flushAiAgentEditorsBeforeProjectSave();
    window.dispatchEvent(new CustomEvent('project:save', {
      detail: { projectId: pid }
    }));

    const cleanupStart = performance.now();
    console.log('[Save][Cleanup] 🔍 START - Detecting orphan tasks from in-memory state');

    const allFlows = (flowsSnapshotBeforeDraftCommit ??
      flowsRef.current) as Record<string, unknown>;
    logFlowSaveDebug('save: allFlows used for domain + orchestrator', {
      usedDraftSnapshot: Boolean(flowsSnapshotBeforeDraftCommit),
      allFlows: summarizeWorkspaceFlowsForDebug(allFlows),
      flowsRefCurrent: summarizeWorkspaceFlowsForDebug(
        flowsRef.current as Record<string, unknown> | undefined
      ),
    });
    const allTasksInMemory = taskRepository.getAllTasks();

    const referencedTaskIds = new Set<string>();
    Object.values(allFlows).forEach((flow: any) => {
      if (flow && flow.nodes && Array.isArray(flow.nodes)) {
        flow.nodes.forEach((node: any) => {
          const nodeData = node.data as FlowNode;
          if (nodeData.rows && Array.isArray(nodeData.rows)) {
            nodeData.rows.forEach((row: any) => {
              if (row.id) {
                referencedTaskIds.add(row.id);
              }
            });
          }
        });
      }
    });

    const orphanTasks = allTasksInMemory.filter(task => !referencedTaskIds.has(task.id));
    const allTasksInMemoryFiltered = allTasksInMemory.filter(task => referencedTaskIds.has(task.id));

    const cleanupEnd = performance.now();
    console.log('[Save][Cleanup] ✅ DONE', {
      ms: Math.round(cleanupEnd - cleanupStart),
      totalTasks: allTasksInMemory.length,
      referencedTaskIds: referencedTaskIds.size,
      orphanTasks: orphanTasks.length,
      tasksToSave: allTasksInMemoryFiltered.length,
      orphanTaskIds: orphanTasks.map(t => t.id)
    });

    if (orphanTasks.length > 0) {
      const orphanTasksInfo = orphanTasks.map(t => ({
        id: t.id,
        name: t.name || '(unnamed)',
        type: t.type || 'unknown'
      }));
      console.warn('[Save][Cleanup] ⚠️ Orphan tasks excluded from save', {
        count: orphanTasks.length,
        tasks: orphanTasksInfo
      });
      console.table(orphanTasksInfo);
    }

    const { DialogueTaskService } = await import('../services/DialogueTaskService');
    const { variableCreationService } = await import('../services/VariableCreationService');

    const allTemplates = DialogueTaskService.getAllTemplates();
    const allVariables = variableCreationService.getAllVariables(pid);

    console.log('[Save][Orchestrator] 📊 Loaded data for orchestrator', {
      templatesCount: allTemplates.length,
      variablesCount: allVariables.length,
      templatesSource: allTemplates.reduce((acc: Record<string, number>, t: any) => {
        const source = t.source || 'Project';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {}),
    });

    if (isAiAgentDebugEnabled()) {
      console.log('ALL TASKS BEFORE SAVE', allTasksInMemory.map(summarizeAgentTaskFields));
    }

    const domain = mapUIStateToDomain({
      projectId: pid,
      projectName: currentProject?.name,
      flows: allFlows,
      tasks: allTasksInMemory,
      conditions: projectData?.conditions?.flatMap((cat: any) => cat.items || []) || [],
      templates: allTemplates,
      variables: allVariables,
      metadata: {
        ownerCompany: currentProject?.ownerCompany,
        ownerClient: currentProject?.ownerClient,
      },
    });

    const orchestrator = new ProjectSaveOrchestrator();
    const saveRequest = orchestrator.prepareSave(domain, {
      flows: allFlows,
      allTemplates: allTemplates,
    });

    const validation = orchestrator.validateRequest(saveRequest);
    if (!validation.valid) {
      throw new Error(`Save request validation failed: ${validation.errors.join(', ')}`);
    }

    const { flushFlowPersist } = await import('../services/FlowPersistService');
    const { transformNodesToSimplified, transformEdgesToSimplified } = await import('../flows/flowTransformers');

    const flowsById = buildFlowsByIdForOrchestrator(allFlows);
    logFlowSaveDebug('save: flowsById after buildFlowsByIdForOrchestrator', {
      keys: Object.keys(flowsById),
      perFlow: Object.entries(flowsById).map(([id, f]) => ({
        flowId: id,
        nodes: f.nodes?.length ?? 0,
        edges: f.edges?.length ?? 0,
        hasLocalChanges: f.hasLocalChanges,
      })),
    });

    const saveResult = await orchestrator.executeSave(saveRequest, {
      translationsContext: (window as any).__projectTranslationsContext,
      flowsById,
      flowState: {
        flushFlowPersist: async () => {
          await flushFlowPersist();
        },
        getFlowById: (id: string) => {
          const f = flowsById?.[id];
          return f ? { nodes: f.nodes ?? [], edges: f.edges ?? [] } : null;
        },
        getNodes: () => flowsById?.main?.nodes ?? [],
        getEdges: () => flowsById?.main?.edges ?? [],
        transformNodesToSimplified,
        transformEdgesToSimplified,
      },
      taskRepository,
      variableService: variableCreationService,
      dialogueTaskService: DialogueTaskService,
      projectDataService: ProjectDataService,
      projectData,
    });

    if (saveResult.success) {
      clearWorkspaceRestoreForProject(pid);
      const persisted = saveResult.results?.flow?.persistedFlowIds;
      if (persisted && persisted.length > 0) {
        markFlowsPersistedRef.current?.(persisted);
      }
      console.log('[Save][Orchestrator] ✅ Save completed successfully', {
        projectId: pid,
        duration: saveResult.duration,
      });
      try {
        const { saveDebuggerUseCasesToProject } = await import(
          '../features/useCases/persistence/projectDebuggerUseCasesApi'
        );
        await saveDebuggerUseCasesToProject(pid, debuggerUseCasesRef.current);
      } catch (e) {
        console.error('[Save] Failed to persist debugger use cases', e);
        throw e instanceof Error ? e : new Error(String(e));
      }
    } else {
      console.error('[Save][Orchestrator] ❌ Save completed with errors', {
        projectId: pid,
        duration: saveResult.duration,
        errors: saveResult.errors,
      });
      throw new Error(`Save failed: ${saveResult.errors?.join(', ') || 'Unknown error'}`);
    }
  }, [
    pdUpdate,
    projectManager,
    currentProject,
    flowsRef,
    projectData,
    refreshData,
    markFlowsPersistedRef,
  ]);

  // Listen for TaskEditor open events (open as docking tab)
  React.useEffect(() => {
    let lastOpenKey = '';
    let lastOpenAt = 0;
    const h = async (e: any) => {
      try {
        const d = (e && e.detail) || {};
        // ✅ FIX: Verifica esplicitamente undefined/null invece di falsy (0 è falsy ma valido per TaskType.SayMessage)
        if (!d || !d.id || (d.type === undefined || d.type === null)) {
          return;
        }
        const eventKey = `${String(d.id)}|${String(d.type)}|${String(d.flowId ?? '')}`;
        const now = Date.now();
        if (eventKey === lastOpenKey && now - lastOpenAt < 250) {
          return;
        }
        lastOpenKey = eventKey;
        lastOpenAt = now;

        // ✅ REFACTOR: Use EditorCoordinator (async)
        setDockTree(prev => {
          // Start async operation
          editorCoordinator.openTaskEditor(prev, d)
            .then(result => setDockTree(result))
            .catch(err => console.error('[TaskEditor] Error in coordinator', err));
          // Return current state immediately (async update will happen via setDockTree in then)
          return prev;
        });
      } catch (err) {
        console.error('[TaskEditor] Failed to open', err);
      }
    };
    document.addEventListener('taskEditor:open', h as any);
    return () => document.removeEventListener('taskEditor:open', h as any);
  }, [editorCoordinator]);

  // Global flow debugger passes nodes/edges/tasks via props (FlowWorkspaceSnapshot); FontProvider wraps DDEBubbleChat.
  // Stato per feedback salvataggio
  // const [isSaving, setIsSaving] = useState(false);
  // const [saveSuccess, setSaveSuccess] = useState(false);
  // const [saveError, setSaveError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [latestVersionInfo, setLatestVersionInfo] = useState<{ isLatest: boolean; latestVersion: string | null }>({ isLatest: true, latestVersion: null });
  const [catalogForSaveAs, setCatalogForSaveAs] = useState<Array<{ projectName?: string; name?: string; clientName?: string; version?: string }>>([]);
  useEffect(() => {
    if (!currentProject?.id || !currentProject?.name) {
      setLatestVersionInfo({ isLatest: true, latestVersion: null });
      setCatalogForSaveAs([]);
      return;
    }
    let cancelled = false;
    ProjectService.getAllProjects()
      .then((list) => {
        if (cancelled) return;
        const name = (currentProject.name || '').trim();
        const client = (currentProject.clientName ?? '').trim();
        const sameFamily = list.filter(
          (p: any) => (p.projectName || p.name || '').trim() === name && (p.clientName ?? '').trim() === client
        );
        const versions = sameFamily.map((p: any) => (p.version || '').trim()).filter(Boolean);
        const latest = getLatestVersion(versions);
        const current = (currentProject.version || '1.0').trim();
        const isLatest = latest !== null && compareVersions(current, latest) === 0;
        setLatestVersionInfo({ isLatest, latestVersion: latest });
        setCatalogForSaveAs(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        setLatestVersionInfo({ isLatest: true, latestVersion: null });
        setCatalogForSaveAs([]);
      });
    return () => { cancelled = true; };
  }, [currentProject?.id, currentProject?.name, currentProject?.clientName, currentProject?.version]);

  const [showBackendBuilder, setShowBackendBuilder] = useState(false);
  const [globalDataPanelOpen, setGlobalDataPanelOpen] = useState(false);
  const [showGlobalDebugger, setShowGlobalDebugger] = useState(false);
  const [showUseCasePanel, setShowUseCasePanel] = useState(false);
  /** When set, global debugger runs this flow; when null, uses {@link FlowWorkspaceSnapshot.getActiveFlowId}. */
  const [debuggerTargetFlowId, setDebuggerTargetFlowId] = useState<string | null>(null);
  const [debuggerLaunchKey, setDebuggerLaunchKey] = useState(0);
  const [debuggerSnapshotTick, setDebuggerSnapshotTick] = useState(0);
  const [debuggerWidth, setDebuggerWidth] = useState(380); // Larghezza dinamica invece di fissa
  const [useCasePanelWidth, setUseCasePanelWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingUseCase, setIsResizingUseCase] = useState(false);
  const [runtimeMessagesSnapshot, setRuntimeMessagesSnapshot] = useState<Message[]>([]);
  const runtimeBridgeRef = React.useRef<DebuggerRuntimeBridge | null>(null);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [selectedUseCaseId, setSelectedUseCaseId] = useState<string | null>(null);
  const [useCaseRunResults, setUseCaseRunResults] = useState<UseCaseRunResult[]>([]);
  const [editIntentUseCaseId, setEditIntentUseCaseId] = useState<string | null>(null);

  React.useEffect(() => {
    debuggerUseCasesRef.current = useCases;
  }, [useCases]);

  React.useEffect(() => {
    openGlobalDebuggerForFlowRef.current = (flowId: string) => {
      setDebuggerTargetFlowId(flowId);
      setShowGlobalDebugger(true);
      setDebuggerLaunchKey((k) => k + 1);
    };
  }, []);

  React.useEffect(() => {
    if (!showGlobalDebugger) {
      setShowUseCasePanel(false);
      runtimeBridgeRef.current = null;
    }
  }, [showGlobalDebugger]);

  React.useEffect(() => {
    if (!showGlobalDebugger) return;
    return FlowWorkspaceSnapshot.subscribe(() => setDebuggerSnapshotTick((t) => t + 1));
  }, [showGlobalDebugger]);

  // Handler per il resize del pannello di debug
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleResize = React.useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const container = document.getElementById('flow-workspace-debugger-row');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newWidth = rect.right - e.clientX;

    // Limiti: minimo 200px, massimo 800px
    const clampedWidth = Math.max(200, Math.min(800, newWidth));
    setDebuggerWidth(clampedWidth);
  }, [isResizing]);

  const handleResizeEnd = React.useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResize, handleResizeEnd]);

  const handleUseCaseResizeStart = React.useCallback((e: React.MouseEvent) => {
    setIsResizingUseCase(true);
    e.preventDefault();
  }, []);

  const handleUseCaseResize = React.useCallback((e: MouseEvent) => {
    if (!isResizingUseCase) return;
    const container = document.getElementById('flow-workspace-debugger-row');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const anchorX = rect.right - debuggerWidth;
    const next = e.clientX - anchorX;
    const clamped = Math.max(260, Math.min(620, next));
    setUseCasePanelWidth(clamped);
  }, [isResizingUseCase, debuggerWidth]);

  const handleUseCaseResizeEnd = React.useCallback(() => {
    setIsResizingUseCase(false);
  }, []);

  React.useEffect(() => {
    if (!isResizingUseCase) return;
    document.addEventListener('mousemove', handleUseCaseResize);
    document.addEventListener('mouseup', handleUseCaseResizeEnd);
    return () => {
      document.removeEventListener('mousemove', handleUseCaseResize);
      document.removeEventListener('mouseup', handleUseCaseResizeEnd);
    };
  }, [isResizingUseCase, handleUseCaseResize, handleUseCaseResizeEnd]);

  React.useEffect(() => {
    let cancelled = false;
    const pid = String(currentPid || '').trim();
    if (!pid) {
      setUseCases([]);
      setSelectedUseCaseId(null);
      return;
    }
    void (async () => {
      try {
        const { loadDebuggerUseCasesFromProject } = await import(
          '../features/useCases/persistence/projectDebuggerUseCasesApi'
        );
        const loaded = await loadDebuggerUseCasesFromProject(pid);
        if (cancelled) return;
        setUseCases(loaded);
        if (loaded.length > 0) {
          setSelectedUseCaseId((prev) =>
            prev && loaded.some((x) => x.id === prev) ? prev : loaded[0].id
          );
        } else {
          setSelectedUseCaseId(null);
        }
      } catch (e) {
        console.error('[UseCases] load from project failed', e);
        if (!cancelled) setUseCases([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPid]);

  /** In-memory only until project save (persisted via project_meta.debuggerRegressionUseCases). */
  const persistUseCases = React.useCallback((next: UseCase[]) => {
    setUseCases(next);
  }, []);

  const createEmptyUseCase = React.useCallback(() => {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `uc-${Date.now()}`;
    const keyBase = 'newUseCase';
    const existingKeys = new Set(useCases.map((x) => x.key));
    let key = keyBase;
    let i = 1;
    while (existingKeys.has(key)) {
      key = `${keyBase}.${i}`;
      i += 1;
    }
    const uc: UseCase = { id, key, label: `Usecase:${key}`, steps: [] };
    const next = [...useCases, uc];
    persistUseCases(next);
    setSelectedUseCaseId(id);
    setEditIntentUseCaseId(id);
  }, [useCases, persistUseCases]);

  /**
   * Saves current debugger conversation as a new use case: opens panel, appends use case, starts rename edit.
   */
  const saveUseCaseFromDebugger = React.useCallback(
    (payload: { suggestedKey: string; messages: Message[] }) => {
      setShowUseCasePanel(true);
      const rawBase = String(payload.suggestedKey || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.')
        .replace(/^\.+|\.+$/g, '');
      const base = rawBase || 'scenario';
      const existingKeys = new Set(useCases.map((x) => x.key));
      let dotKey = base;
      let n = 0;
      while (existingKeys.has(dotKey)) {
        n += 1;
        dotKey = `${base}.${n}`;
      }
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `uc-${Date.now()}`;
      const created = buildUseCaseFromDebuggerMessages({
        id,
        key: dotKey,
        label: `Usecase:${dotKey}`,
        messages: payload.messages,
      });
      persistUseCases([...useCases, created]);
      setSelectedUseCaseId(created.id);
      setEditIntentUseCaseId(created.id);
    },
    [useCases, persistUseCases]
  );

  const runtimePort = React.useMemo<UseCaseRuntimePort | null>(() => {
    if (!runtimeBridgeRef.current) return null;
    return {
      restart: async () => {
        const bridge = runtimeBridgeRef.current;
        if (!bridge) throw new Error('Runtime bridge is not available.');
        await bridge.restart();
      },
      executeUtterance: async (utterance: string) => {
        const bridge = runtimeBridgeRef.current;
        if (!bridge) throw new Error('Runtime bridge is not available.');
        await bridge.waitUntilWaitingForInput(20000);
        const before = bridge.getMessages().filter((m) => m.type === 'bot').length;
        await bridge.sendUserInput(utterance);
        const bot = await bridge.waitForNextBotMessage(before, 12000);
        const all = bridge.getMessages();
        const latestUser = [...all].reverse().find((m) => m.type === 'user' && m.text === utterance);
        const semanticValue = (latestUser?.extractedValues || [])
          .map((x) => `${x.variable}:${String(x.semanticValue ?? '')}`)
          .join('|');
        const linguisticValue = (latestUser?.extractedValues || [])
          .map((x) => `${x.variable}:${String(x.linguisticValue ?? '')}`)
          .join('|');
        return {
          semanticValue,
          linguisticValue,
          grammarUsed: {
            type: String(bot?.stepType || ''),
            contract: String(bot?.textKey || ''),
          },
          botResponse: String(bot?.text || ''),
        };
      },
    };
  }, [runtimeMessagesSnapshot]);

  const runUseCaseById = React.useCallback(async (id: string) => {
    const selected = useCases.find((x) => x.id === id);
    if (!selected) return;
    if (!runtimePort) {
      alert('Open the debugger runtime before running a use case.');
      return;
    }
    const results = await runUseCase(selected, runtimePort);
    setSelectedUseCaseId(id);
    setUseCaseRunResults(results);
  }, [useCases, runtimePort]);

  const renameUseCase = React.useCallback((id: string, nextKey: string) => {
    const next = useCases.map((x) => (x.id === id ? withUseCaseKey(x, nextKey) : x));
    persistUseCases(next);
  }, [useCases, persistUseCases]);

  const renameFolder = React.useCallback((folderPath: string, nextSegment: string) => {
    const next = renameFolderPrefix(useCases, folderPath, nextSegment);
    persistUseCases(next);
  }, [useCases, persistUseCases]);

  const deleteUseCaseNode = React.useCallback((fullPath: string, useCaseId?: string) => {
    const fp = String(fullPath || '').trim();
    if (!fp) return;
    if (useCaseId) {
      const next = useCases.filter((x) => x.id !== useCaseId);
      persistUseCases(next);
      setSelectedUseCaseId((prev) => (prev === useCaseId ? (next[0]?.id || null) : prev));
      return;
    }
    const prefix = `${fp}.`;
    const next = useCases.filter((x) => x.key !== fp && !x.key.startsWith(prefix));
    persistUseCases(next);
    setSelectedUseCaseId((prev) =>
      prev && next.some((x) => x.id === prev) ? prev : (next[0]?.id ?? null)
    );
  }, [useCases, persistUseCases]);

  const saveUseCaseNote = React.useCallback(
    (id: string, note: string) => {
      const next = UseCaseNoteManager.setNote(useCases, id, note);
      persistUseCases(next);
    },
    [useCases, persistUseCases]
  );

  const moveUseCaseToFolder = React.useCallback((id: string, folderPath: string) => {
    const next = useCases.map((x) => (x.id === id ? moveUseCaseKeyToFolder(x, folderPath) : x));
    persistUseCases(next);
  }, [useCases, persistUseCases]);

  const createRelativeUseCase = React.useCallback(
    (targetPath: string, mode: 'before' | 'after' | 'child') => {
      const normalizedTarget = String(targetPath || '').trim();
      if (!normalizedTarget) return;
      const targetParts = normalizedTarget.split('.').filter(Boolean);
      if (targetParts.length === 0) return;

      const siblingParent = targetParts.slice(0, -1).join('.');
      const basePrefix = mode === 'child' ? normalizedTarget : siblingParent;
      const existing = new Set(useCases.map((x) => x.key));
      const leafBase = 'untitled';
      let leaf = leafBase;
      let i = 1;
      const composeKey = () => (basePrefix ? `${basePrefix}.${leaf}` : leaf);
      while (existing.has(composeKey())) {
        leaf = `${leafBase}${i}`;
        i += 1;
      }
      const nextKey = composeKey();

      const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `uc-${Date.now()}`;
      const created: UseCase = {
        id,
        key: nextKey,
        label: `Usecase:${nextKey}`,
        steps: [],
      };

      let insertAt = useCases.length;
      if (mode !== 'child') {
        const idxByExact = useCases.findIndex((x) => x.key === normalizedTarget);
        if (idxByExact >= 0) {
          insertAt = mode === 'before' ? idxByExact : idxByExact + 1;
        } else {
          const siblingPrefix = siblingParent ? `${siblingParent}.` : '';
          const siblingStart = useCases.findIndex((x) =>
            siblingPrefix ? x.key.startsWith(siblingPrefix) && x.key.split('.').length === targetParts.length : !x.key.includes('.')
          );
          if (siblingStart >= 0) {
            insertAt = siblingStart;
          }
        }
      }

      const next = [...useCases];
      next.splice(Math.max(0, Math.min(insertAt, next.length)), 0, created);
      persistUseCases(next);
      setSelectedUseCaseId(created.id);
      setEditIntentUseCaseId(created.id);
    },
    [useCases, persistUseCases]
  );

  // ✅ REMOVED: Duplicate handleTestSingleNode definition - already defined before renderTabContent

  // ✅ DEBUG: Verify handleTestSingleNode is stable (log removed to reduce noise)
  // React.useEffect(() => {
  //   console.log('[AppContent] handleTestSingleNode defined:', {
  //     hasHandleTestSingleNode: !!handleTestSingleNode,
  //     handleTestSingleNodeName: handleTestSingleNode?.name,
  //   });
  // }, [handleTestSingleNode]);

  const handleRunFlow = React.useCallback(() => {
    console.log('[AppContent] handleRunFlow -> global flow debugger');
    void import('../context/CompilationErrorsContext').then(({ clearCompilationErrorsGlobal }) => {
      clearCompilationErrorsGlobal();
    });
    setDebuggerTargetFlowId(null);
    setShowGlobalDebugger(true);
    setDebuggerLaunchKey((k) => k + 1);
  }, []);

  // Listen to Sidebar wrench
  React.useEffect(() => {
    const handler = () => setShowBackendBuilder(true);
    document.addEventListener('backendBuilder:open', handler);
    return () => document.removeEventListener('backendBuilder:open', handler);
  }, []);

  // Open ConditionEditor as docking tab
  React.useEffect(() => {
    const handler = async (e: any) => {
      const d = (e && e.detail) || {};
      try {
        // ✅ REFACTOR: Use EditorCoordinator (async)
        setDockTree(prev => {
          // Start async operation
          editorCoordinator.openConditionEditor(prev, d)
            .then(result => setDockTree(result))
            .catch(err => console.error('[ConditionEditor] Error in coordinator', err));
          // Return current state immediately (async update will happen via setDockTree in then)
          return prev;
        });
      } catch (err) {
        console.error('[ConditionEditor] Failed to open', err);
      }
    };
    document.addEventListener('conditionEditor:open', handler as any);
    return () => document.removeEventListener('conditionEditor:open', handler as any);
  }, [editorCoordinator]);

  // ✅ NEW: Handle conditionEditor:update event (when AI generation completes)
  React.useEffect(() => {
    const handler = (e: any) => {
      const d = (e && e.detail) || {};
      const { tabId, script, isGenerating } = d;
      if (!tabId) return;

      setDockTree(prev => {
        return mapNode(prev, (n: any) => {
          if (n.kind === 'tabset') {
            const idx = n.tabs.findIndex((t: any) => t.id === tabId);
            if (idx !== -1) {
              const updated = [...n.tabs];
              updated[idx] = {
                ...updated[idx],
                script: script !== undefined ? script : updated[idx].script,
                isGenerating: isGenerating !== undefined ? isGenerating : updated[idx].isGenerating,
              };
              return { ...n, tabs: updated };
            }
          }
          return n;
        });
      });
    };
    document.addEventListener('conditionEditor:update', handler as any);
    return () => document.removeEventListener('conditionEditor:update', handler as any);
  }, []);

  // ✅ REMOVED: conditionEditor:updateEdge event listener
  // Edge updates now happen synchronously via EdgeConditionUpdater when conditions are created

  // ✅ NEW: Handle conditionEditor:conditionValidated event (remove errors when condition is valid)
  React.useEffect(() => {
    const handler = async (e: any) => {
      const d = (e && e.detail) || {};
      const { edgeId, label } = d;
      if (!edgeId) return;

      try {
        const { useCompilationErrors, setCompilationErrorsGlobal } = await import('../context/CompilationErrorsContext');
        // Get current errors from context (we need to access them)
        // Since we can't use hooks here, we'll use the global setter pattern
        // We need to get current errors first - use a custom event to request them
        const getErrorsEvent = new CustomEvent('compilationErrors:get', {
          detail: { requestId: Date.now() },
          bubbles: true
        });
        document.dispatchEvent(getErrorsEvent);

        // Alternative: use a ref or state to track errors
        // For now, we'll use a simpler approach: recompile to get fresh errors
        // But that's not ideal. Let's use the context directly if available.

        // Actually, the best approach is to filter errors in the context itself
        // But since we can't access the context state here, we'll emit an event
        // that the CompilationErrorsContext can listen to
        document.dispatchEvent(new CustomEvent('compilationErrors:removeEdge', {
          detail: { edgeId },
          bubbles: true
        }));
      } catch (e) {
        console.warn('[AppContent] Failed to remove edge errors', e);
      }
    };
    document.addEventListener('conditionEditor:conditionValidated', handler as any);
    return () => document.removeEventListener('conditionEditor:conditionValidated', handler as any);
  }, []);

  // Stato per gestione progetti
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [showAllProjectsModal, setShowAllProjectsModal] = useState(false);
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ✅ REMOVED: Service unavailable listener - now handled in ResponseEditor with centered overlay
  const [searchTerm, setSearchTerm] = useState('');

  // Stato per finestre editor TaskTree aperte (ora con react-mosaic)
  // const [mosaicNodes, setMosaicNodes] = useState<any>(null);

  // Rimuovi questi stati che ora sono nel hook
  // const [selectedDDT, setSelectedDDT] = useState<any | null>(null);
  // const [selectedDDTLanguage, setSelectedDDTLanguage] = useState<string>('it');
  // const [openedDDTId, setOpenedDDTId] = useState<string>('');
  // const [dialogueTemplates, setDialogueTemplates] = useState<any[]>([]);

  // Rimuovi questi handler che ora sono nel hook
  // const handleOpenDDTEditor = useCallback(...);
  // const handleCloseDDTEditor = useCallback(...);
  // const handleDeleteDDT = useCallback(...);

  // Pannello di test in alto a sinistra all'avvio
  // React.useEffect(() => {
  //       taskTree: { label: 'Test Panel' },
  //       translations: {},
  //       lang: 'it'
  //     });
  //   }
  // }, []);

  // ✅ REFACTOR: Use ProjectManager
  const fetchRecentProjects = React.useCallback(async () => {
    const result = await projectManager.fetchRecentProjects();
    setRecentProjects(result.projects);
    setProjectsLoadError(result.error);
  }, [projectManager]);

  const fetchAllProjects = React.useCallback(async () => {
    const result = await projectManager.fetchAllProjects();
    setAllProjects(result.projects);
    setProjectsLoadError(result.error);
    return result.projects; // Return projects for checking if any remain
  }, [projectManager]);

  // ✅ REFACTOR: Use ProjectManager
  const handleDeleteProject = useCallback(async (id: string) => {
    await projectManager.deleteProject(id);
    await fetchRecentProjects();
    const updatedProjects = await fetchAllProjects();
    // Mostra toast solo se ci sono ancora progetti dopo l'eliminazione
    if (updatedProjects && updatedProjects.length > 0) {
      setToast('Progetto eliminato!');
      setTimeout(() => setToast(null), 2000);
    }
  }, [projectManager, fetchRecentProjects, fetchAllProjects]);

  const handleDeleteAllProjects = useCallback(async () => {
    await projectManager.deleteAllProjects();
    await fetchRecentProjects();
    await fetchAllProjects();
  }, [projectManager, fetchRecentProjects, fetchAllProjects]);

  // Callback per LandingPage
  const handleLandingNewProject = useCallback(() => setAppState('creatingProject'), [setAppState]);
  // const handleLandingLoadProject = useCallback(async () => { await fetchRecentProjects(); }, [fetchRecentProjects]);
  // const handleLandingShowAllProjects = useCallback(async () => { await fetchAllProjects(); setShowAllProjectsModal(true); }, [fetchAllProjects]);

  // const handleOpenNewProjectModal = useCallback(() => setAppState('creatingProject'), [setAppState]);

  // ✅ REFACTOR: Use ProjectManager
  const handleCreateProject = useCallback(async (projectInfo: ProjectInfo): Promise<boolean> => {
    setCreateError(null);
    setIsCreatingProject(true);
    try {
      const result = await projectManager.createDraftProject(projectInfo);
      if (!result.success) {
        setCreateError(result.error || 'Errore nell\'apertura della bozza');
      }
      return result.success;
    } finally {
      setIsCreatingProject(false);
    }
  }, [projectManager]);

  const handleCloseNewProjectModal = useCallback(() => setAppState('landing'), [setAppState]);

  // const handleSaveProject = useCallback(async () => { /* legacy save */ }, [currentProject, nodes, edges]);

  // ✅ REFACTOR: Use ProjectManager (simplified - complex error handling kept in AppContent for now)
  const handleOpenProjectById = useCallback(async (id: string) => {
    if (!id) return;
    const result = await projectManager.openProjectById(id);
    if (!result.success) {
      alert('Errore: ' + (result.error || 'Errore nell\'apertura del progetto'));
    }
  }, [projectManager]);

  const handleShowRecentProjects = useCallback(async (id?: string) => {
    if (id) {
      await handleOpenProjectById(id);
      setAppState('mainApp');
      return;
    }
    try {
      const response = await fetch('/projects');
      if (!response.ok) throw new Error('Errore nel recupero progetti');
      const projects = await response.json();
      if (!projects.length) {
        alert('Nessun progetto recente trovato.');
        return;
      }
      const choices = projects.map((p: any, i: number) => `${i + 1}. ${p.name || '(senza nome)'} [${p._id}]`).join('\n');
      const idx = prompt(`Progetti recenti:\n${choices}\n\nInserisci il numero del progetto da caricare:`);
      const selected = parseInt(idx || '', 10);
      if (!selected || selected < 1 || selected > projects.length) return;
      const selId = projects[selected - 1]._id;
      await handleOpenProjectById(selId);
      setAppState('mainApp');
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : err));
    }
  }, [handleOpenProjectById, setAppState]);

  // Passa una funzione a NewProjectModal per azzerare l'errore duplicato quando cambia il nome
  const handleProjectNameChange = useCallback(() => {
    if (createError) setCreateError(null);
  }, [createError]);

  // Carica progetti recenti e tutti i progetti ogni volta che si entra nella landing
  useEffect(() => {
    if (appState === 'landing') {
      // Log rimosso: non essenziale per flusso motore
      fetchRecentProjects();
      fetchAllProjects(); // Carica anche tutti i progetti per la vista "tutti"
    }
  }, [appState, fetchRecentProjects, fetchAllProjects]);

  // ✅ Applica font globali dallo store
  const { combinedClass } = useFontClasses();

  const globalDebuggerFlowProps = React.useMemo(() => {
    if (!showGlobalDebugger) return null;
    void debuggerSnapshotTick;
    const fid = debuggerTargetFlowId ?? FlowWorkspaceSnapshot.getActiveFlowId();
    const slice = FlowWorkspaceSnapshot.getFlowById(fid);
    const flowsTitleMap: Record<string, { title?: string }> = {};
    for (const id of FlowWorkspaceSnapshot.getAllFlowIds()) {
      const s = FlowWorkspaceSnapshot.getFlowById(id);
      if (s) flowsTitleMap[id] = { title: (s as { title?: string }).title };
    }
    const executionFlowName = resolveFlowTabDisplayTitle(fid, flowsTitleMap);
    return {
      flowId: fid,
      nodes: slice?.nodes ?? [],
      edges: slice?.edges ?? [],
      tasks: (slice as { tasks?: unknown[] } | null)?.tasks ?? [],
      executionFlowName,
    };
  }, [showGlobalDebugger, debuggerTargetFlowId, debuggerLaunchKey, debuggerSnapshotTick]);

  return (
    <div className={`h-screen overflow-hidden ${combinedClass}`} style={{ position: 'relative' }}>
      {/* overlay ricarico rimosso per test */}
      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded shadow-lg z-50 animate-fade-in ${toast.includes('⚠️') ? 'bg-yellow-600' : 'bg-emerald-700'
          } text-white`}>
          {toast}
        </div>
      )}
      {/* Landing Page + New Project Modal */}
      {(appState === 'landing' || appState === 'creatingProject') && (
        <>
          <LandingPage
            onNewProject={handleLandingNewProject}
            recentProjects={recentProjects}
            allProjects={allProjects}
            onDeleteProject={handleDeleteProject}
            onDeleteAllProjects={handleDeleteAllProjects}
            showAllProjectsModal={showAllProjectsModal}
            setShowAllProjectsModal={setShowAllProjectsModal}
            loadError={projectsLoadError}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSelectProject={async (id: string) => {
              await handleOpenProjectById(id);
              setAppState('mainApp');
            }}
          />
          <NewProjectModal
            isOpen={appState === 'creatingProject'}
            onClose={handleCloseNewProjectModal}
            onCreateProject={handleCreateProject}
            onLoadProject={handleShowRecentProjects}
            duplicateNameError={createError}
            onProjectNameChange={handleProjectNameChange}
            isLoading={isCreatingProject}
            onFactoryTemplatesLoaded={() => { /* templates loaded; proxied via 8000 now */ }}
          />
        </>
      )}
      {/* Main App: Toolbar a tutta larghezza + Sidebar collassabile + FlowEditor */}
      {appState === 'mainApp' && (
        <div className="flex flex-col h-screen">
          {/* Toolbar a tutta larghezza */}
          <Toolbar
            onHome={() => setAppState('landing')}
            onOpenProject={() => setAppState('landing')}
            isSaving={isCreatingProject}
            currentProject={currentProject}
            currentProjectId={currentPid || null}
            existingProjectsForSaveAs={catalogForSaveAs}
            onCloseProject={() => {
              setCurrentProject(null);
              setAppState('landing');
              localStorage.removeItem('currentProjectId');
            }}
            onSaveAs={async (payload) => {
              if (!currentProject?.id) return;
              setCloneError(null);
              setIsCreatingProject(true);
              try {
                await runProjectSave();
                const newProjectId = await createProjectVersion(
                  buildCreateVersionPayload({
                    projectName: payload.name,
                    version: payload.version,
                    versionQualifier: payload.versionQualifier,
                    clientName: payload.clientName ?? undefined,
                  })
                );
                await projectManager.openProjectById(newProjectId);
              } catch (e) {
                setCloneError(e instanceof Error ? e.message : String(e));
              } finally {
                setIsCreatingProject(false);
              }
            }}
            isLatestVersion={latestVersionInfo.isLatest}
            latestVersion={latestVersionInfo.latestVersion}
            onSaveAsNewMinor={currentProject?.id ? async () => {
              setCloneError(null);
              setIsCreatingProject(true);
              try {
                await runProjectSave();
                const newVersion = getNextMinor(currentProject.version || '1.0');
                const newProjectId = await createProjectVersion(
                  buildCreateVersionPayload({ version: newVersion })
                );
                await projectManager.openProjectById(newProjectId);
              } catch (e) {
                setCloneError(e instanceof Error ? e.message : String(e));
              } finally {
                setIsCreatingProject(false);
              }
            } : undefined}
            onSaveAsNewMajor={currentProject?.id ? async () => {
              setCloneError(null);
              setIsCreatingProject(true);
              try {
                await runProjectSave();
                const newVersion = getNextMajor(currentProject.version || '1.0');
                const newProjectId = await createProjectVersion(
                  buildCreateVersionPayload({ version: newVersion })
                );
                await projectManager.openProjectById(newProjectId);
              } catch (e) {
                setCloneError(e instanceof Error ? e.message : String(e));
              } finally {
                setIsCreatingProject(false);
              }
            } : undefined}
            saveError={cloneError}
            onSave={async () => {
              setCloneError(null);
              setIsCreatingProject(true);
              try {
                await runProjectSave();
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                setCloneError(msg);
                console.error('[SaveProject] commit error', e);
              } finally {
                setIsCreatingProject(false);
              }
            }}
            onRun={handleRunFlow}
            onSettings={() => setShowBackendBuilder(true)}
            globalDataOpen={globalDataPanelOpen}
            onGlobalDataToggle={() => setGlobalDataPanelOpen((v) => !v)}
            onOpenLibrary={() => setIsSidebarCollapsed(false)}
          />

          <GlobalProjectDataPanel
            open={globalDataPanelOpen}
            onClose={() => setGlobalDataPanelOpen(false)}
            projectId={currentPid}
          />

          {/* Area principale: Sidebar + Canvas */}
          <div className="flex flex-1 relative overflow-hidden">
            {/* Sidebar con animazione slide */}
            <div
              className={`
                transition-transform duration-300 ease-in-out
                ${isSidebarCollapsed
                  ? 'transform -translate-x-full absolute left-0 h-full pointer-events-none'
                  : 'transform translate-x-0 relative pointer-events-auto'
                }
              `}
              style={{ zIndex: 40 }}
            >
              <SidebarThemeProvider>
                <Sidebar onClose={() => setIsSidebarCollapsed(true)} />
              </SidebarThemeProvider>
            </div>

            {/* Canvas: workspace flow in #flow-canvas-host; debugger globale sibling in #flow-workspace-debugger-row */}
            <div className="flex-1 flex flex-col min-w-0" style={{ minHeight: 0 }}>
              <div
                id="flow-workspace-debugger-row"
                style={{
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'row',
                  position: 'relative',
                }}
              >
                <div
                  id="flow-canvas-host"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  {showBackendBuilder ? (
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <BackendBuilderStudio onClose={() => setShowBackendBuilder(false)} />
                    </div>
                  ) : (
                    <div
                      style={{
                        position: 'relative',
                        flex: 1,
                        minHeight: 0,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <FlowWorkspaceProvider
                        key={currentPid ?? '__no_project__'}
                        workspaceProjectId={currentPid ?? null}
                      >
                        <WorkspaceDockLifecycle
                          projectId={currentPid}
                          skipPersist={Boolean(currentProject && isDraftProjectId(currentProject.id))}
                          dockTree={dockTree}
                          setDockTree={setDockTree}
                        />
                        <DockManagerWithFlows
                          root={dockTree}
                          setRoot={setDockTree}
                          renderTabContent={renderTabContent}
                          flowsRef={flowsRef}
                          editorCloseRefsMap={editorCloseRefsMap}
                          markFlowsPersistedRef={markFlowsPersistedRef}
                        />
                      </FlowWorkspaceProvider>
                    </div>
                  )}
                </div>
                {showGlobalDebugger && globalDebuggerFlowProps && (
                  <>
                    <div
                      onMouseDown={handleResizeStart}
                      style={{
                        width: '8px',
                        cursor: 'col-resize',
                        backgroundColor: isResizing ? '#3b82f6' : 'transparent',
                        zIndex: 10,
                        userSelect: 'none',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        if (!isResizing) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = '#e5e7eb';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isResizing) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                        }
                      }}
                    />
                    <div
                      style={{
                        width: `${debuggerWidth}px`,
                        position: 'relative',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        borderLeft: '1px solid #e5e7eb',
                        flexShrink: 0,
                      }}
                    >
                      <FontProvider>
                        <DDEBubbleChat
                          key={`global-dbg-${globalDebuggerFlowProps.flowId}-${debuggerLaunchKey}`}
                          task={null}
                          projectId={currentPid ?? null}
                          translations={compiledTranslations || {}}
                          taskTree={null}
                          mode="interactive"
                          flowNodes={globalDebuggerFlowProps.nodes}
                          flowEdges={globalDebuggerFlowProps.edges}
                          flowTasks={globalDebuggerFlowProps.tasks}
                          executionFlowName={globalDebuggerFlowProps.executionFlowName}
                          orchestratorCompileRootFlowId={globalDebuggerFlowProps.flowId}
                          flowAutoStart
                          executionLaunchType="flow"
                          onToggleUseCasePanel={() => setShowUseCasePanel((v) => !v)}
                          onSaveUseCase={saveUseCaseFromDebugger}
                          onRuntimeBridgeReady={(bridge) => {
                            runtimeBridgeRef.current = bridge;
                            setRuntimeMessagesSnapshot(bridge?.getMessages() || []);
                          }}
                          onMessagesSnapshotChange={setRuntimeMessagesSnapshot}
                          onClosePanel={() => {
                            setShowGlobalDebugger(false);
                            setDebuggerTargetFlowId(null);
                            setShowUseCasePanel(false);
                          }}
                        />
                      </FontProvider>
                    </div>
                    {showUseCasePanel && (
                      <>
                        <div
                          onMouseDown={handleUseCaseResizeStart}
                          style={{
                            width: '8px',
                            cursor: 'col-resize',
                            backgroundColor: isResizingUseCase ? '#3b82f6' : 'transparent',
                            zIndex: 10,
                            userSelect: 'none',
                            flexShrink: 0,
                          }}
                        />
                        <div
                          style={{
                            width: `${useCasePanelWidth}px`,
                            position: 'relative',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            borderLeft: '1px solid #1f2937',
                            flexShrink: 0,
                          }}
                        >
                          <UseCaseEditorPanel
                            useCases={useCases}
                            selectedUseCaseId={selectedUseCaseId}
                            onSelectUseCase={setSelectedUseCaseId}
                            onCreateUseCase={createEmptyUseCase}
                            onRenameUseCase={renameUseCase}
                            onRenameFolder={renameFolder}
                            onDeleteNode={deleteUseCaseNode}
                            onSaveNote={saveUseCaseNote}
                            onMoveUseCaseToFolder={moveUseCaseToFolder}
                            onCreateRelativeUseCase={createRelativeUseCase}
                            editIntentUseCaseId={editIntentUseCaseId}
                            onConsumeEditIntentUseCaseId={() => setEditIntentUseCaseId(null)}
                            onRunUseCase={(id) => {
                              void runUseCaseById(id);
                            }}
                            runResults={useCaseRunResults}
                            onClosePanel={() => setShowUseCasePanel(false)}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Old TaskTree Wizard Modal removed - now using new TaskBuilderAIWizard integrated in ResponseEditor */}
    </div>
  );
};