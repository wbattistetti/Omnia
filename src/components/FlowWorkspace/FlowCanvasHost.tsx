import React, { useEffect, useCallback, useMemo } from 'react';
import { useFlowWorkspace, useFlowActions as useFlowStoreActions } from '@flows/FlowStore';
import { loadFlow } from '../../flows/FlowPersistence';
import { explainShouldLoadFlowFromServer } from '../../flows/flowHydrationPolicy';
import { logFlowSaveDebug } from '../../utils/flowSaveDebug';
import { logFlowHydrationTrace } from '../../utils/flowHydrationTrace';
import { formatUnknownError } from '../../utils/httpErrorFormatting';
import { logSubflowCanvasDebug, summarizeFlowSlice } from '../../utils/subflowCanvasDebug';
import { logUpsertSubflowEmptyNodesCaller } from '../../utils/flowStructuralCommitDiagnostic';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { FlowVariablesRail } from './FlowVariablesRail';
import { FlowCanvasDockRow } from './FlowCanvasDockRow';
import { isFlowInterfacePanelEnabled } from '@flows/flowInterfaceUiPolicy';
import { FlowTestProvider } from '../../context/FlowTestContext';
import { FlowActionsProvider } from '../../context/FlowActionsContext';
import { useEntityCreation } from '../../hooks/useEntityCreation';
import { useProjectData } from '../../context/ProjectDataContext';
import { variableCreationService } from '../../services/VariableCreationService';
import { resolveVariableStoreProjectId, isFallbackProjectBucket } from '../../utils/safeProjectId';
import { buildFlowCanvasRowFingerprint } from '../../utils/flowWorkspaceUtteranceFingerprint';
import type { ToolbarButton } from '@dock/types';
import { Database, Play, Workflow } from 'lucide-react';
import { collectSubflowPortalRows } from './collectSubflowPortalRows';
import { resolveFlowTabDisplayTitle } from '@utils/resolveFlowTabDisplayTitle';

/**
 * Title persisted on the flow slice: keep non-empty server/local titles; otherwise resolve from
 * Subflow task name (avoids freezing the generic "Subflow" placeholder in the store).
 */
function flowSliceTitle(
  flowId: string,
  storedTitle: string | undefined,
  flows: Record<string, { title?: string } | undefined>
): string {
  const t = (storedTitle || '').trim();
  if (t.length > 0) return t;
  return resolveFlowTabDisplayTitle(flowId, flows);
}

type Props = {
  /** When undefined (draft project), flow is kept in memory only until first Save. */
  projectId: string | undefined;
  flowId: string;
  testSingleNode?: (nodeId: string, nodeRows?: any[]) => Promise<void>;
  onCreateTaskFlow?: (flowId: string, title: string, nodes: any[], edges: any[]) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
  /** Opens a subflow tab for a Flow-type row (taskId, optional existingFlowId, optional title, optional canvas node id for pan-after-split) */
  onOpenSubflowForTask?: (taskId: string, existingFlowId?: string, title?: string, canvasNodeId?: string) => void;
  /** When set (AppContent dock), Data/Subdialogs toggles are shown on the dock tab bar instead of edge handles. */
  onToolbarUpdate?: (toolbar: ToolbarButton[], headerColor: string) => void;
  /** Run this flow canvas in the global debugger panel (AppContent). */
  onRunFlowInDebugger?: (flowId: string) => void;
};

/** Teal header bar for flow dock tab (full-width strip, readable with white labels). */
const FLOW_DOCK_HEADER_COLOR = '#0e7490';

export const FlowCanvasHost: React.FC<Props> = ({
  projectId,
  flowId,
  testSingleNode,
  onCreateTaskFlow,
  onOpenTaskFlow,
  onOpenSubflowForTask,
  onToolbarUpdate,
  onRunFlowInDebugger,
}) => {
  const { data: projectData } = useProjectData();
  const { flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph, applyFlowLoadResult } = useFlowStoreActions();
  const [isLoadingFlow, setIsLoadingFlow] = React.useState(false);
  const [variablesPanelOpen, setVariablesPanelOpen] = React.useState(false);
  const [dataSectionOn, setDataSectionOn] = React.useState(true);
  const [subdialogsSectionOn, setSubdialogsSectionOn] = React.useState(true);

  const entityCreation = useEntityCreation();

  const flowDisplayName = useMemo(
    () => flowSliceTitle(flowId, flows[flowId]?.title, flows as Record<string, { title?: string } | undefined>),
    [flowId, flows, flows[flowId]?.title]
  );

  const resolvedProjectId = useMemo(() => resolveVariableStoreProjectId(projectId), [projectId]);

  const hasDataForToolbar = useMemo(() => {
    if (!resolvedProjectId || isFallbackProjectBucket(resolvedProjectId)) return false;
    return variableCreationService.getVariablesForFlowScope(resolvedProjectId, flowId, flows).length > 0;
  }, [resolvedProjectId, flowId, flows, projectData]);

  const subflowPortalRowsDock = useMemo(() => collectSubflowPortalRows(flows, flowId), [flows, flowId]);
  const hasSubdialogsForToolbar = subflowPortalRowsDock.length > 0;

  const flowSidePanelTitle = useMemo(() => {
    const d = dataSectionOn && hasDataForToolbar;
    const s = subdialogsSectionOn && hasSubdialogsForToolbar;
    if (d && s) return 'Data & Subdialogs';
    if (d) return 'Data';
    if (s) return 'Subdialogs';
    return 'Flow';
  }, [dataSectionOn, subdialogsSectionOn, hasDataForToolbar, hasSubdialogsForToolbar]);

  useEffect(() => {
    if (!hasDataForToolbar) setDataSectionOn(false);
  }, [hasDataForToolbar]);

  useEffect(() => {
    if (!hasSubdialogsForToolbar) setSubdialogsSectionOn(false);
  }, [hasSubdialogsForToolbar]);

  useEffect(() => {
    if (!dataSectionOn && !subdialogsSectionOn) setVariablesPanelOpen(false);
  }, [dataSectionOn, subdialogsSectionOn]);

  useEffect(() => {
    if (!onToolbarUpdate) return;
    const iconClass = 'w-3.5 h-3.5 shrink-0 opacity-95';
    const buttons: ToolbarButton[] = [];
    if (onRunFlowInDebugger) {
      buttons.push({
        icon: <Play className={iconClass} strokeWidth={2} aria-hidden />,
        label: 'Run',
        title: `Esegui debug su questo flusso (${flowDisplayName})`,
        active: false,
        onClick: () => onRunFlowInDebugger(flowId),
      });
    }
    if (hasDataForToolbar) {
      buttons.push({
        icon: <Database className={iconClass} strokeWidth={2} aria-hidden />,
        label: 'Data',
        title: `Sezione Data per ${flowDisplayName}`,
        active: dataSectionOn,
        onClick: () => {
          setDataSectionOn((v) => {
            const next = !v;
            if (next) setVariablesPanelOpen(true);
            return next;
          });
        },
      });
    }
    if (hasSubdialogsForToolbar) {
      buttons.push({
        icon: <Workflow className={iconClass} strokeWidth={2} aria-hidden />,
        label: 'Subdialogs',
        title: `Subdialog (Subflow) nel canvas di ${flowDisplayName}`,
        active: subdialogsSectionOn,
        onClick: () => {
          setSubdialogsSectionOn((v) => {
            const next = !v;
            if (next) setVariablesPanelOpen(true);
            return next;
          });
        },
      });
    }
    onToolbarUpdate(buttons, FLOW_DOCK_HEADER_COLOR);
  }, [
    onToolbarUpdate,
    onRunFlowInDebugger,
    flowDisplayName,
    flowId,
    hasDataForToolbar,
    hasSubdialogsForToolbar,
    dataSectionOn,
    subdialogsSectionOn,
  ]);

  const flowSlice = flows[flowId];
  const flowPresent = flowSlice !== undefined;
  const hydrated = flowSlice?.hydrated;
  const hasLocalChanges = flowSlice?.hasLocalChanges;
  const nodeCount = flowSlice?.nodes?.length ?? 0;
  const edgeCount = flowSlice?.edges?.length ?? 0;

  /** Re-hydrate utterance variables as soon as the workspace graph is available (ordering vs DockManager). */
  const utteranceHydrationFingerprint = useMemo(
    () => buildFlowCanvasRowFingerprint(flows as any),
    [flows]
  );

  useEffect(() => {
    const pid = resolveVariableStoreProjectId(projectId);
    if (!pid || isFallbackProjectBucket(pid)) return;
    if (!flows || Object.keys(flows).length === 0) return;
    variableCreationService.hydrateVariablesFromFlow(pid, flows as any);
    try {
      document.dispatchEvent(new CustomEvent('variableStore:updated', { bubbles: true }));
    } catch {
      /* noop */
    }
  }, [projectId, utteranceHydrationFingerprint]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId || String(projectId).trim() === '') {
      setIsLoadingFlow(false);
      logFlowSaveDebug('FlowCanvasHost: skip load (no projectId)', { flowId });
      if (!flows[flowId]) {
        const placeholder = {
          id: flowId,
          title: flowSliceTitle(flowId, flows[flowId]?.title, flows as Record<string, { title?: string } | undefined>),
          nodes: [],
          edges: [],
          hydrated: false,
          variablesReady: false,
          hasLocalChanges: false,
        };
        logUpsertSubflowEmptyNodesCaller('FlowCanvasHost:noProjectIdPlaceholder', placeholder);
        upsertFlow(placeholder);
      }
      return;
    }

    const flow = flows[flowId];
    if (!flow) {
      logFlowHydrationTrace('FlowCanvasHost: no flow slice — direct loadFlow + upsertFlow', {
        flowId,
        projectId,
      });
      logFlowSaveDebug('FlowCanvasHost: flow slice missing; direct server load', { flowId, projectId });
      logSubflowCanvasDebug('FlowCanvasHost: no slice yet — will loadFlow then UPSERT (replaces entire slice)', {
        flowId,
        projectId,
      });
      setIsLoadingFlow(true);
      (async () => {
        try {
          const data = await loadFlow(projectId, flowId);
          if (cancelled) return;
          logSubflowCanvasDebug('FlowCanvasHost: initial loadFlow response (missing slice path)', {
            flowId,
            serverNodeCount: data.nodes.length,
            serverEdgeCount: data.edges.length,
          });
          logFlowHydrationTrace('FlowCanvasHost: missing-slice upsertFlow after loadFlow', {
            flowId,
            projectId,
            dataNodeCount: data.nodes.length,
            dataEdgeCount: data.edges.length,
          });
          upsertFlow({
            id: flowId,
            title: flowSliceTitle(flowId, flow?.title, flows as Record<string, { title?: string } | undefined>),
            nodes: data.nodes,
            edges: data.edges,
            ...(data.meta !== undefined ? { meta: data.meta } : {}),
            tasks: data.tasks,
            variables: data.variables,
            bindings: data.bindings,
            hydrated: true,
            variablesReady: false,
            hasLocalChanges: false,
            // FIX-MAIN-EMPTY — same semantics as APPLY_FLOW_LOAD_RESULT (policy stable-empty guard).
            serverHydrationApplied: true,
          } as any);
        } catch (e) {
          if (cancelled) return;
          const errText = formatUnknownError(e);
          console.error(`[FlowCanvasHost] initial loadFlow failed: ${errText}`, {
            projectId,
            flowId,
            cause: e,
          });
          const failedLoad = {
            id: flowId,
            title: flowSliceTitle(flowId, flow?.title, flows as Record<string, { title?: string } | undefined>),
            nodes: [],
            edges: [],
            hydrated: false,
            variablesReady: false,
            hasLocalChanges: false,
          };
          logUpsertSubflowEmptyNodesCaller('FlowCanvasHost:initialLoadFlowFailed', failedLoad);
          upsertFlow(failedLoad);
        } finally {
          if (!cancelled) {
            setIsLoadingFlow(false);
          }
        }
      })();
      return;
    }

    const explain = explainShouldLoadFlowFromServer(projectId, flow);
    logFlowHydrationTrace('FlowCanvasHost: hydration effect tick', {
      flowId,
      projectId,
      flowPresent: true,
      sliceNodeCount: flow.nodes?.length ?? 0,
      sliceEdgeCount: flow.edges?.length ?? 0,
      hydrated: flow.hydrated,
      hasLocalChanges: flow.hasLocalChanges,
      serverHydrationApplied: flow.serverHydrationApplied,
      shouldLoad: explain.shouldLoad,
      reason: explain.reason,
    });
    logSubflowCanvasDebug('FlowCanvasHost: hydration effect tick', {
      flowId,
      explainReason: explain.reason,
      shouldLoad: explain.shouldLoad,
      slice: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
    });
    if (!explain.shouldLoad) {
      setIsLoadingFlow(false);
      logFlowHydrationTrace('FlowCanvasHost: skip server loadFlow (policy)', {
        projectId,
        flowId,
        reason: explain.reason,
        shouldLoad: explain.shouldLoad,
      });
      logFlowSaveDebug('FlowCanvasHost: skip server loadFlow', {
        projectId,
        flowId,
        ...explain,
      });
      if (explain.reason === 'local_nonempty_skip_server_fetch') {
        logSubflowCanvasDebug('FlowCanvasHost: marking hydrated without fetch (local_nonempty_skip_server_fetch)', {
          flowId,
          sliceBeforeUpsert: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
        });
        upsertFlow({
          ...flow,
          hydrated: true,
          variablesReady: false,
          hasLocalChanges: true,
        });
      }
      return;
    }

    logFlowSaveDebug('FlowCanvasHost: fetching loadFlow', {
      projectId,
      flowId,
      ...explain,
    });
    setIsLoadingFlow(true);

    (async () => {
      let data: Awaited<ReturnType<typeof loadFlow>>;
      try {
        data = await loadFlow(projectId, flowId);
      } catch (e) {
        if (!cancelled) {
          setIsLoadingFlow(false);
        }
        const errText = formatUnknownError(e);
        logFlowHydrationTrace('FlowCanvasHost: loadFlow threw', {
          projectId,
          flowId,
          error: errText,
        });
        console.error(`[FlowCanvasHost] loadFlow failed: ${errText}`, { projectId, flowId, cause: e });
        return;
      }
      if (cancelled) return;
      logFlowHydrationTrace('FlowCanvasHost: dispatching applyFlowLoadResult', {
        projectId,
        flowId,
        payloadNodeCount: data.nodes.length,
        payloadEdgeCount: data.edges.length,
        hasMeta: data.meta !== undefined,
      });
      logFlowSaveDebug('FlowCanvasHost: applyFlowLoadResult', {
        projectId,
        flowId,
        nodes: data.nodes.length,
        edges: data.edges.length,
        hasMeta: data.meta !== undefined,
      });
      logSubflowCanvasDebug('FlowCanvasHost: about to applyFlowLoadResult (server → store)', {
        flowId,
        serverNodeCount: data.nodes.length,
        serverEdgeCount: data.edges.length,
        note:
          'Slice snapshot omitted here (async closure may be stale vs store if portal updated graph meanwhile). See FlowStore:APPLY_FLOW_LOAD_RESULT for before/after.',
      });
      applyFlowLoadResult(flowId, {
        nodes: data.nodes,
        edges: data.edges,
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
        tasks: data.tasks,
        variables: data.variables,
        bindings: data.bindings,
      });
      setIsLoadingFlow(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, flowId, flowPresent, hydrated, hasLocalChanges, nodeCount, edgeCount, upsertFlow, applyFlowLoadResult]);

  const flow = flows[flowId];

  // Stable setNodes function for FlowActionsProvider
  const setNodes = useCallback(
    (updater: any) => updateFlowGraph(flowId, (ns, es) => ({
      nodes: typeof updater === 'function' ? updater(ns) : updater,
      edges: es
    })),
    [flowId, updateFlowGraph]
  );

  // Stable setEdges function for FlowActionsProvider
  const setEdges = useCallback(
    (updater: any) => updateFlowGraph(flowId, (ns, es) => ({
      nodes: ns,
      edges: typeof updater === 'function' ? updater(es) : updater
    })),
    [flowId, updateFlowGraph]
  );

  // FlowEditor wraps IntellisenseProvider + ReactFlowProvider (see FlowEditor.tsx)
  const flowEditor = (
    <FlowEditor
      flowId={flowId}
      nodes={flow?.nodes || []}
      edges={flow?.edges || []}
      setNodes={setNodes}
      setEdges={setEdges}
      currentProject={{ id: projectId, name: 'Project' } as any}
      setCurrentProject={() => { }}
      testPanelOpen={false}
      setTestPanelOpen={() => { }}
      testNodeId={null}
      setTestNodeId={() => { }}
      onCreateTaskFlow={onCreateTaskFlow}
      onOpenTaskFlow={onOpenTaskFlow}
      onOpenSubflowForTask={onOpenSubflowForTask}
    />
  );

  const canvasSlot = (
    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="h-full w-full min-h-0 min-w-0">{flowEditor}</div>
      {isLoadingFlow ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-[1px] text-sm font-medium text-slate-700"
          role="status"
          aria-live="polite"
        >
          Loading flow...
        </div>
      ) : null}
    </div>
  );

  const variablesRail = (
    <FlowVariablesRail
      flowId={flowId}
      projectId={projectId}
      workspaceFlows={flows}
      flowInterfaceSectionsEnabled={isFlowInterfacePanelEnabled(flowId)}
      onOpenSubflowPortalGear={
        onOpenSubflowForTask
          ? (taskId, existingFlowId, rowLabel, canvasNodeId) =>
              onOpenSubflowForTask(taskId, existingFlowId, rowLabel, canvasNodeId)
          : undefined
      }
      {...(onToolbarUpdate
        ? {
            open: variablesPanelOpen,
            onOpenChange: (next: boolean) => {
              setVariablesPanelOpen(next);
              if (next) {
                if (hasDataForToolbar) setDataSectionOn(true);
                if (hasSubdialogsForToolbar) setSubdialogsSectionOn(true);
              }
            },
            hideEdgeToggle: true,
            dockSectionTogglesInToolbar: true,
            dataSectionOn,
            subdialogsSectionOn,
            hasDataAvailable: hasDataForToolbar,
            hasSubdialogsAvailable: hasSubdialogsForToolbar,
            panelTitle: flowSidePanelTitle,
            subflowPortalRows: subflowPortalRowsDock,
          }
        : {})}
    />
  );

  const withFlowActions = (
    <FlowActionsProvider
      setNodes={setNodes}
      setEdges={setEdges}
      createFactoryTask={entityCreation.createFactoryTask}
      createBackendCall={entityCreation.createBackendCall}
      createTask={entityCreation.createTask}
      createCondition={entityCreation.createCondition}
    >
      <FlowCanvasDockRow canvas={canvasSlot} sidePanel={variablesRail} />
    </FlowActionsProvider>
  );

  // ✅ Wrap with FlowTestProvider if testSingleNode is provided
  if (testSingleNode) {
    return (
      <FlowTestProvider testSingleNode={testSingleNode}>
        {withFlowActions}
      </FlowTestProvider>
    );
  }

  return withFlowActions;
};
