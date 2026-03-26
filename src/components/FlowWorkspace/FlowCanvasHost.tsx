import React, { useEffect, useCallback } from 'react';
import { useFlowWorkspace, useFlowActions as useFlowStoreActions } from '@flows/FlowStore';
import { loadFlow } from '../../flows/FlowPersistence';
import { explainShouldLoadFlowFromServer } from '../../flows/flowHydrationPolicy';
import { logFlowSaveDebug } from '../../utils/flowSaveDebug';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { FlowVariablesRail } from './FlowVariablesRail';
import { FlowInterfaceBottomPanel } from './FlowInterfaceBottomPanel';
import { isFlowInterfacePanelEnabled } from '@flows/flowInterfaceUiPolicy';
import { FlowTestProvider } from '../../context/FlowTestContext';
import { FlowActionsProvider } from '../../context/FlowActionsContext';
import { useEntityCreation } from '../../hooks/useEntityCreation';

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
  /** Opens a subflow tab for a Flow-type row (taskId, optional existingFlowId, optional title = row label) */
  onOpenSubflowForTask?: (taskId: string, existingFlowId?: string, title?: string) => void;
};

export const FlowCanvasHost: React.FC<Props> = ({ projectId, flowId, testSingleNode, onCreateTaskFlow, onOpenTaskFlow, onOpenSubflowForTask }) => {
  const { flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph, applyFlowLoadResult } = useFlowStoreActions();
  const [isLoadingFlow, setIsLoadingFlow] = React.useState(false);

  const entityCreation = useEntityCreation();

  const flowSlice = flows[flowId];
  const flowPresent = flowSlice !== undefined;
  const hydrated = flowSlice?.hydrated;
  const hasLocalChanges = flowSlice?.hasLocalChanges;
  const nodeCount = flowSlice?.nodes?.length ?? 0;
  const edgeCount = flowSlice?.edges?.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    if (!projectId || String(projectId).trim() === '') {
      setIsLoadingFlow(false);
      logFlowSaveDebug('FlowCanvasHost: skip load (no projectId)', { flowId });
      if (!flows[flowId]) {
        upsertFlow({
          id: flowId,
          title: pickFlowTitle(flowId, flows[flowId]?.title),
          nodes: [],
          edges: [],
          hydrated: false,
          hasLocalChanges: false,
        });
      }
      return;
    }

    const flow = flows[flowId];
    if (!flow) {
      logFlowSaveDebug('FlowCanvasHost: flow slice missing; direct server load', { flowId, projectId });
      setIsLoadingFlow(true);
      (async () => {
        try {
          const data = await loadFlow(projectId, flowId);
          if (cancelled) return;
          upsertFlow({
            id: flowId,
            title: pickFlowTitle(flowId, flow?.title),
            nodes: data.nodes,
            edges: data.edges,
            ...(data.meta !== undefined ? { meta: data.meta } : {}),
            hydrated: true,
            hasLocalChanges: false,
          } as any);
        } catch (e) {
          if (cancelled) return;
          console.error('[FlowCanvasHost] initial loadFlow failed', { projectId, flowId, e });
          upsertFlow({
            id: flowId,
            title: pickFlowTitle(flowId, flow?.title),
            nodes: [],
            edges: [],
            hydrated: false,
            hasLocalChanges: false,
          });
        } finally {
          if (!cancelled) {
            setIsLoadingFlow(false);
          }
        }
      })();
      return;
    }

    const explain = explainShouldLoadFlowFromServer(projectId, flow);
    if (!explain.shouldLoad) {
      setIsLoadingFlow(false);
      logFlowSaveDebug('FlowCanvasHost: skip server loadFlow', {
        projectId,
        flowId,
        ...explain,
      });
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

  // Wrap FlowEditor with providers + right Variables rail (per flowId)
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
      <div className="relative flex flex-1 min-h-0 w-full h-full min-w-0 overflow-hidden">
        <div className="absolute inset-0 z-0 min-h-0 min-w-0">{flowEditor}</div>
        {isLoadingFlow ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[1px] text-sm font-medium text-slate-700">
            Loading flow...
          </div>
        ) : null}
        {isFlowInterfacePanelEnabled(flowId) ? <FlowInterfaceBottomPanel flowId={flowId} /> : null}
        <FlowVariablesRail flowId={flowId} projectId={projectId} />
      </div>
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
