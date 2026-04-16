import React, { useEffect } from 'react';
import { FlowWorkspaceProvider, useFlowWorkspace, useFlowActions } from '@flows/FlowStore';
import { setActiveFlowCanvasId } from '../../flows/activeFlowCanvas';
import { FlowTabBar } from './FlowTabBar';
import { loadFlow, saveFlow } from '../../flows/FlowPersistence';
import { explainShouldLoadFlowFromServer } from '../../flows/flowHydrationPolicy';
import { dlog } from '../../utils/debug';
import { logFlowHydrationTrace } from '../../utils/flowHydrationTrace';
import { formatUnknownError } from '../../utils/httpErrorFormatting';
import { logSubflowCanvasDebug, summarizeFlowSlice } from '../../utils/subflowCanvasDebug';
import { logUpsertSubflowEmptyNodesCaller } from '../../utils/flowStructuralCommitDiagnostic';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { FlowVariablesRail } from './FlowVariablesRail';
import { FlowCanvasDockRow } from './FlowCanvasDockRow';
import { isFlowInterfacePanelEnabled } from '@flows/flowInterfaceUiPolicy';
// Adapter: renderizza l'attuale FlowEditor per activeFlowId con nodes/edges del workspace
const FlowHost: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { activeFlowId, flows } = useFlowWorkspace();
  const flowsForSave = flows;
  const { upsertFlow, updateFlowGraph, openFlow, openFlowBackground, applyFlowLoadResult, markFlowsPersisted } =
    useFlowActions();

  const flowSlice = flows[activeFlowId];
  const flowPresent = flowSlice !== undefined;
  const hydrated = flowSlice?.hydrated;
  const hasLocalChanges = flowSlice?.hasLocalChanges;
  const nodeCount = flowSlice?.nodes?.length ?? 0;
  const edgeCount = flowSlice?.edges?.length ?? 0;

  useEffect(() => {
    setActiveFlowCanvasId(activeFlowId);
  }, [activeFlowId]);

  // Lazy load from API only when a real project id exists; otherwise keep in-memory draft graph.
  useEffect(() => {
    if (!projectId || String(projectId).trim() === '') return;
    let cancelled = false;
    const flow = flows[activeFlowId];
    if (!flow) {
      const placeholder = {
        id: activeFlowId,
        title: activeFlowId === 'main' ? 'Main' : activeFlowId,
        nodes: [],
        edges: [],
        hydrated: false,
        variablesReady: false,
        hasLocalChanges: false,
      };
      logUpsertSubflowEmptyNodesCaller('FlowWorkspace:activeTabMissingSlice', placeholder);
      upsertFlow(placeholder);
      return;
    }
    const explain = explainShouldLoadFlowFromServer(projectId, flow);
    logFlowHydrationTrace('FlowWorkspace (second loader): hydration tick', {
      activeFlowId,
      projectId,
      shouldLoad: explain.shouldLoad,
      reason: explain.reason,
      sliceNodeCount: flow.nodes?.length ?? 0,
      sliceHydrated: flow.hydrated,
      serverHydrationApplied: flow.serverHydrationApplied,
    });
    logSubflowCanvasDebug('FlowWorkspace:active-tab hydration (second loader; can race FlowCanvasHost)', {
      activeFlowId,
      explainReason: explain.reason,
      shouldLoad: explain.shouldLoad,
      slice: summarizeFlowSlice(flow as any, { rowIdsSample: true }),
    });
    if (!explain.shouldLoad) {
      if (explain.reason === 'local_nonempty_skip_server_fetch') {
        logSubflowCanvasDebug('FlowWorkspace: local_nonempty_skip_server_fetch → mark hydrated', {
          activeFlowId,
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
    (async () => {
      let data: Awaited<ReturnType<typeof loadFlow>>;
      try {
        data = await loadFlow(projectId, activeFlowId);
      } catch (e) {
        const errText = formatUnknownError(e);
        logFlowHydrationTrace('FlowWorkspace: loadFlow threw', {
          projectId,
          activeFlowId,
          error: errText,
        });
        console.error(`[FlowWorkspace] loadFlow failed: ${errText}`, { projectId, activeFlowId, cause: e });
        return;
      }
      if (cancelled) return;
      logFlowHydrationTrace('FlowWorkspace: applyFlowLoadResult (active tab)', {
        activeFlowId,
        projectId,
        payloadNodeCount: data.nodes.length,
        payloadEdgeCount: data.edges.length,
      });
      logSubflowCanvasDebug('FlowWorkspace: applyFlowLoadResult (active tab)', {
        activeFlowId,
        serverNodeCount: data.nodes.length,
        serverEdgeCount: data.edges.length,
      });
      applyFlowLoadResult(activeFlowId, {
        nodes: data.nodes,
        edges: data.edges,
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
        tasks: data.tasks,
        variables: data.variables,
        bindings: data.bindings,
      });
      dlog('flow', '[workspace.loaded]', { projectId, activeFlowId, nodes: data.nodes.length, edges: data.edges.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeFlowId, projectId, flowPresent, hydrated, hasLocalChanges, nodeCount, edgeCount, upsertFlow, applyFlowLoadResult]);

  const flow = flows[activeFlowId];

  return (
    <div className="flex-1 h-full flex flex-col">
      <FlowTabBar />
      <div className="flex-1 min-h-0 relative flex flex-col min-w-0">
        <FlowCanvasDockRow
          canvas={
            <div className="h-full w-full min-h-0 min-w-0">
              <FlowEditor
                flowId={activeFlowId}
                nodes={flow?.nodes || []}
                edges={flow?.edges || []}
                setNodes={(updater: any) => updateFlowGraph(activeFlowId, (ns, es) => ({ nodes: typeof updater === 'function' ? updater(ns) : updater, edges: es }))}
                setEdges={(updater: any) => updateFlowGraph(activeFlowId, (ns, es) => ({ nodes: ns, edges: typeof updater === 'function' ? updater(es) : updater }))}
                currentProject={{ id: projectId, name: 'Project' } as any}
                setCurrentProject={() => {}}
                testPanelOpen={false}
                setTestPanelOpen={() => {}}
                testNodeId={null}
                setTestNodeId={() => {}}
                onPlayNode={() => {}}
                onCreateTaskFlow={(newFlowId, title, nodes, edges) => {
                  dlog('flow', '[workspace.onCreateTaskFlow]', { newFlowId, title, nodes: nodes.length, edges: edges.length });
                  const derivedTitle = (title && String(title).trim()) || 'Task';
                  const slice = {
                    id: newFlowId,
                    title: derivedTitle,
                    nodes,
                    edges,
                    hydrated: false,
                    variablesReady: false,
                    hasLocalChanges: true,
                  };
                  upsertFlow(slice);
                  const flowsSnapshot = { ...flowsForSave, [newFlowId]: slice };
                  setTimeout(() => openFlowBackground(newFlowId), 0);
                  if (projectId && String(projectId).trim() !== '') {
                    saveFlow(projectId, newFlowId, nodes, edges, flowsSnapshot).then(
                      () => markFlowsPersisted([newFlowId]),
                      (e) => {
                        try { console.warn('[flow] save subflow failed (kept in memory)', e); } catch {}
                      }
                    );
                  }
                }}
              />
            </div>
          }
          sidePanel={
            <FlowVariablesRail
              flowId={activeFlowId}
              projectId={projectId}
              workspaceFlows={flows}
              flowInterfaceSectionsEnabled={isFlowInterfacePanelEnabled(activeFlowId)}
            />
          }
        />
      </div>
    </div>
  );
};

export const FlowWorkspace: React.FC<{ projectId?: string }> = ({ projectId }) => {
  return (
    <FlowWorkspaceProvider>
      <FlowHost projectId={projectId} />
    </FlowWorkspaceProvider>
  );
};
