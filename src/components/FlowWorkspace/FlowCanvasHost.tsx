import React, { useEffect, useCallback, useMemo } from 'react';
import { useFlowWorkspace, useFlowActions as useFlowStoreActions } from '@flows/FlowStore';
import { loadFlow } from '../../flows/FlowPersistence';
import { explainShouldLoadFlowFromServer } from '../../flows/flowHydrationPolicy';
import { logFlowSaveDebug } from '../../utils/flowSaveDebug';
import { logSubflowCanvasDebug, summarizeFlowSlice } from '../../utils/subflowCanvasDebug';
import { logUpsertSubflowEmptyNodesCaller } from '../../utils/flowStructuralCommitDiagnostic';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { FlowVariablesRail } from './FlowVariablesRail';
import { FlowInterfaceBottomPanel } from './FlowInterfaceBottomPanel';
import { isFlowInterfacePanelEnabled } from '@flows/flowInterfaceUiPolicy';
import { FlowTestProvider } from '../../context/FlowTestContext';
import { FlowActionsProvider } from '../../context/FlowActionsContext';
import { useEntityCreation } from '../../hooks/useEntityCreation';
import { useProjectData } from '../../context/ProjectDataContext';
import { variableCreationService } from '../../services/VariableCreationService';
import { resolveVariableStoreProjectId, isFallbackProjectBucket } from '../../utils/safeProjectId';
import { buildFlowCanvasRowFingerprint } from '../../utils/flowWorkspaceUtteranceFingerprint';
import type { ToolbarButton } from '@dock/types';
import { ArrowUpFromLine, Database } from 'lucide-react';

function getDefaultFlowTitle(flowId: string): string {
  return flowId === 'main' ? 'MAIN' : 'Subflow';
}

function pickFlowTitle(flowId: string, currentTitle: string | undefined): string {
  const title = (currentTitle || '').trim();
  if (title.length > 0) {
    return title;
  }
  return getDefaultFlowTitle(flowId);
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
  /** When set (AppContent dock), Variables/Interfaces toggles are shown on the dock tab bar instead of edge handles. */
  onToolbarUpdate?: (toolbar: ToolbarButton[], headerColor: string) => void;
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
}) => {
  const { data: projectData } = useProjectData();
  const { flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph, applyFlowLoadResult } = useFlowStoreActions();
  const [isLoadingFlow, setIsLoadingFlow] = React.useState(false);
  const [variablesPanelOpen, setVariablesPanelOpen] = React.useState(false);
  const [interfacePanelOpen, setInterfacePanelOpen] = React.useState(false);

  const entityCreation = useEntityCreation();

  const flowDisplayName = useMemo(
    () => pickFlowTitle(flowId, flows[flowId]?.title),
    [flowId, flows[flowId]?.title]
  );

  useEffect(() => {
    if (!onToolbarUpdate) return;
    const iconClass = 'w-3.5 h-3.5 shrink-0 opacity-95';
    const dataTitle = `Mostra tutti i dati interni a ${flowDisplayName}.`;
    const outputTitle = `Mostra i dati che ${flowDisplayName} può fornire all'esterno.`;
    const buttons: ToolbarButton[] = [
      {
        icon: <Database className={iconClass} strokeWidth={2} aria-hidden />,
        label: 'Data',
        title: dataTitle,
        active: variablesPanelOpen,
        onClick: () => setVariablesPanelOpen((o) => !o),
      },
    ];
    if (isFlowInterfacePanelEnabled(flowId)) {
      buttons.push({
        icon: <ArrowUpFromLine className={iconClass} strokeWidth={2} aria-hidden />,
        label: 'Output',
        title: outputTitle,
        active: interfacePanelOpen,
        onClick: () => setInterfacePanelOpen((o) => !o),
      });
    }
    onToolbarUpdate(buttons, FLOW_DOCK_HEADER_COLOR);
  }, [onToolbarUpdate, variablesPanelOpen, interfacePanelOpen, flowId, flowDisplayName]);

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
          title: pickFlowTitle(flowId, flows[flowId]?.title),
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
          upsertFlow({
            id: flowId,
            title: pickFlowTitle(flowId, flow?.title),
            nodes: data.nodes,
            edges: data.edges,
            ...(data.meta !== undefined ? { meta: data.meta } : {}),
            hydrated: true,
            variablesReady: false,
            hasLocalChanges: false,
          } as any);
        } catch (e) {
          if (cancelled) return;
          console.error('[FlowCanvasHost] initial loadFlow failed', { projectId, flowId, e });
          const failedLoad = {
            id: flowId,
            title: pickFlowTitle(flowId, flow?.title),
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
    logSubflowCanvasDebug('FlowCanvasHost: hydration effect tick', {
      flowId,
      explainReason: explain.reason,
      shouldLoad: explain.shouldLoad,
      slice: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
    });
    if (!explain.shouldLoad) {
      setIsLoadingFlow(false);
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
        console.error('[FlowCanvasHost] loadFlow failed', { projectId, flowId, e });
        return;
      }
      if (cancelled) return;
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

  const withFlowActions = (
    <FlowActionsProvider
      setNodes={setNodes}
      setEdges={setEdges}
      createFactoryTask={entityCreation.createFactoryTask}
      createBackendCall={entityCreation.createBackendCall}
      createTask={entityCreation.createTask}
      createCondition={entityCreation.createCondition}
    >
      {onToolbarUpdate ? (
        <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-row overflow-hidden">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="absolute inset-0 z-0 min-h-0 min-w-0">{flowEditor}</div>
            {isLoadingFlow ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px] text-sm font-medium text-slate-700">
                Loading flow...
              </div>
            ) : null}
            {isFlowInterfacePanelEnabled(flowId) ? (
              <FlowInterfaceBottomPanel
                flowId={flowId}
                projectId={projectId}
                open={interfacePanelOpen}
                onOpenChange={setInterfacePanelOpen}
                hideEdgeToggle
              />
            ) : null}
          </div>
          <FlowVariablesRail
            flowId={flowId}
            projectId={projectId}
            open={variablesPanelOpen}
            onOpenChange={setVariablesPanelOpen}
            hideEdgeToggle
            dockAsColumn
          />
        </div>
      ) : (
        <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <div className="absolute inset-0 z-0 min-h-0 min-w-0">{flowEditor}</div>
          {isLoadingFlow ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px] text-sm font-medium text-slate-700">
              Loading flow...
            </div>
          ) : null}
          {isFlowInterfacePanelEnabled(flowId) ? (
            <FlowInterfaceBottomPanel flowId={flowId} projectId={projectId} />
          ) : null}
          <FlowVariablesRail flowId={flowId} projectId={projectId} />
        </div>
      )}
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
