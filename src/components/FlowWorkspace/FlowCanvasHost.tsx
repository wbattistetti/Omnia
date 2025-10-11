import React, { useEffect } from 'react';
import { useFlowWorkspace, useFlowActions } from '../../flows/FlowStore.tsx';
import { loadFlow } from '../../flows/FlowPersistence';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { dlog } from '../../utils/debug';
import { useProjectDataUpdate } from '../../context/ProjectDataContext';

type Props = { projectId: string; flowId: string; onCreateTaskFlow?: (flowId: string, title: string, nodes: any[], edges: any[]) => void; onOpenTaskFlow?: (flowId: string, title: string) => void };

export const FlowCanvasHost: React.FC<Props> = ({ projectId, flowId, onCreateTaskFlow, onOpenTaskFlow }) => {
  const { flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph } = useFlowActions();
  const pd = useProjectDataUpdate();
  const isDraft = (() => { try { return pd.isDraft(); } catch { return false; } })();

  useEffect(() => {
    (async () => {
      if (!flows[flowId] || (!flows[flowId].nodes?.length && !flows[flowId].edges?.length)) {
        if (isDraft) {
          upsertFlow({ id: flowId, title: flowId === 'main' ? 'Main' : flowId, nodes: [], edges: [] });
          dlog('flow', '[canvas.loaded][draft]', { flowId });
        } else {
          const data = await loadFlow(projectId, flowId);
          upsertFlow({ id: flowId, title: flowId === 'main' ? 'Main' : flowId, nodes: data.nodes, edges: data.edges });
          dlog('flow', '[canvas.loaded]', { flowId, nodes: data.nodes.length, edges: data.edges.length });
        }
      }
    })();
  }, [projectId, flowId]);

  const flow = flows[flowId];
  return (
    <FlowEditor
      flowId={flowId}
      nodes={flow?.nodes || []}
      edges={flow?.edges || []}
      setNodes={(updater: any) => updateFlowGraph(flowId, (ns, es) => ({ nodes: typeof updater === 'function' ? updater(ns) : updater, edges: es }))}
      setEdges={(updater: any) => updateFlowGraph(flowId, (ns, es) => ({ nodes: ns, edges: typeof updater === 'function' ? updater(es) : updater }))}
      currentProject={{ id: projectId, name: 'Project' } as any}
      setCurrentProject={() => {}}
      testPanelOpen={false}
      setTestPanelOpen={() => {}}
      testNodeId={null}
      setTestNodeId={() => {}}
      onPlayNode={() => {}}
      onCreateTaskFlow={onCreateTaskFlow}
      onOpenTaskFlow={onOpenTaskFlow}
    />
  );
};


