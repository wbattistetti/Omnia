import React, { useEffect } from 'react';
import { useFlowWorkspace, useFlowActions } from '../../flows/FlowStore.tsx';
import { loadFlow } from '../../flows/FlowPersistence';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { dlog } from '../../utils/debug';
import { useProjectDataUpdate } from '../../context/ProjectDataContext';
import { FlowTestProvider } from '../../context/FlowTestContext';

type Props = {
  projectId: string;
  flowId: string;
  testSingleNode?: (nodeId: string, nodeRows?: any[]) => Promise<void>;
  onCreateTaskFlow?: (flowId: string, title: string, nodes: any[], edges: any[]) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
};

export const FlowCanvasHost: React.FC<Props> = ({ projectId, flowId, testSingleNode, onCreateTaskFlow, onOpenTaskFlow }) => {
  const { flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph } = useFlowActions();
  const pd = useProjectDataUpdate();

  useEffect(() => {
    (async () => {
      if (!flows[flowId] || (!flows[flowId].nodes?.length && !flows[flowId].edges?.length)) {
        const data = await loadFlow(projectId, flowId);
        upsertFlow({ id: flowId, title: flowId === 'main' ? 'Main' : flowId, nodes: data.nodes, edges: data.edges });
      }
    })();
  }, [projectId, flowId]);

  const flow = flows[flowId];

  // ✅ Wrap FlowEditor with FlowTestProvider if testSingleNode is provided
  const flowEditor = (
    <FlowEditor
      flowId={flowId}
      nodes={flow?.nodes || []}
      edges={flow?.edges || []}
      setNodes={(updater: any) => updateFlowGraph(flowId, (ns, es) => ({ nodes: typeof updater === 'function' ? updater(ns) : updater, edges: es }))}
      setEdges={(updater: any) => updateFlowGraph(flowId, (ns, es) => ({ nodes: ns, edges: typeof updater === 'function' ? updater(es) : updater }))}
      currentProject={{ id: projectId, name: 'Project' } as any}
      setCurrentProject={() => { }}
      testPanelOpen={false}
      setTestPanelOpen={() => { }}
      testNodeId={null}
      setTestNodeId={() => { }}
      onCreateTaskFlow={onCreateTaskFlow}
      onOpenTaskFlow={onOpenTaskFlow}
    />
  );

  // ✅ Wrap with FlowTestProvider if testSingleNode is provided
  if (testSingleNode) {
    return (
      <FlowTestProvider testSingleNode={testSingleNode}>
        {flowEditor}
      </FlowTestProvider>
    );
  }

  return flowEditor;
};


