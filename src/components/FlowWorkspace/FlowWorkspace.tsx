import React, { useEffect } from 'react';
import { FlowWorkspaceProvider, useFlowWorkspace, useFlowActions } from '@flows/FlowStore';
import { setActiveFlowCanvasId } from '../../flows/activeFlowCanvas';
import { FlowTabBar } from './FlowTabBar';
import { loadFlow, saveFlow } from '../../flows/FlowPersistence';
import { shouldLoadFlowFromServer } from '../../flows/flowHydrationPolicy';
import { dlog } from '../../utils/debug';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { FlowVariablesRail } from './FlowVariablesRail';
import { FlowInterfaceBottomPanel } from './FlowInterfaceBottomPanel';
import { isFlowInterfacePanelEnabled } from '@flows/flowInterfaceUiPolicy';

// Adapter: renderizza l'attuale FlowEditor per activeFlowId con nodes/edges del workspace
const FlowHost: React.FC<{ projectId?: string }> = ({ projectId }) => {
  const { activeFlowId, flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph, openFlow, openFlowBackground, applyFlowLoadResult, markFlowsPersisted } = useFlowActions();

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
      upsertFlow({
        id: activeFlowId,
        title: activeFlowId === 'main' ? 'Main' : activeFlowId,
        nodes: [],
        edges: [],
        hydrated: false,
        hasLocalChanges: false,
      });
      return;
    }
    if (!shouldLoadFlowFromServer(projectId, flow)) {
      return;
    }
    (async () => {
      let data: Awaited<ReturnType<typeof loadFlow>>;
      try {
        data = await loadFlow(projectId, activeFlowId);
      } catch (e) {
        console.error('[FlowWorkspace] loadFlow failed', { projectId, activeFlowId, e });
        return;
      }
      if (cancelled) return;
      applyFlowLoadResult(activeFlowId, {
        nodes: data.nodes,
        edges: data.edges,
        ...(data.meta !== undefined ? { meta: data.meta } : {}),
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
      <div className="flex-1 min-h-0 relative flex flex-col">
        <div className="relative flex flex-1 min-h-0 w-full min-w-0 overflow-hidden">
          <div className="absolute inset-0 z-0 min-h-0 min-w-0">
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
                upsertFlow({ id: newFlowId, title: derivedTitle, nodes, edges });
                setTimeout(() => openFlowBackground(newFlowId), 0);
                if (projectId && String(projectId).trim() !== '') {
                  saveFlow(projectId, newFlowId, nodes, edges).then(
                    () => markFlowsPersisted([newFlowId]),
                    (e) => {
                      try { console.warn('[flow] save subflow failed (kept in memory)', e); } catch {}
                    }
                  );
                }
              }}
            />
          </div>
          {isFlowInterfacePanelEnabled(activeFlowId) ? (
            <FlowInterfaceBottomPanel flowId={activeFlowId} projectId={projectId} />
          ) : null}
        </div>
        <FlowVariablesRail flowId={activeFlowId} projectId={projectId} />
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
