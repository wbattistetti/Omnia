import React, { useEffect, useCallback } from 'react';
import { useFlowWorkspace, useFlowActions as useFlowStoreActions } from '../../flows/FlowStore.tsx';
import { loadFlow } from '../../flows/FlowPersistence';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { dlog } from '../../utils/debug';
import { useProjectDataUpdate } from '../../context/ProjectDataContext';
import { FlowTestProvider } from '../../context/FlowTestContext';
import { FlowActionsProvider } from '../../context/FlowActionsContext';
import { useEntityCreation } from '../../hooks/useEntityCreation';

type Props = {
  projectId: string;
  flowId: string;
  testSingleNode?: (nodeId: string, nodeRows?: any[]) => Promise<void>;
  onCreateTaskFlow?: (flowId: string, title: string, nodes: any[], edges: any[]) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
};

export const FlowCanvasHost: React.FC<Props> = ({ projectId, flowId, testSingleNode, onCreateTaskFlow, onOpenTaskFlow }) => {
  const { flows } = useFlowWorkspace();
  const { upsertFlow, updateFlowGraph } = useFlowStoreActions();
  const pd = useProjectDataUpdate();

  const entityCreation = useEntityCreation();

  useEffect(() => {
    (async () => {
      if (!flows[flowId] || (!flows[flowId].nodes?.length && !flows[flowId].edges?.length)) {
        const data = await loadFlow(projectId, flowId);
        upsertFlow({ id: flowId, title: flowId === 'main' ? 'Main' : flowId, nodes: data.nodes, edges: data.edges });
      }
    })();
  }, [projectId, flowId]);

  const flow = flows[flowId];

  // Stable setNodes function for FlowActionsProvider
  const setNodes = useCallback(
    (updater: any) => updateFlowGraph(flowId, (ns, es) => ({
      nodes: typeof updater === 'function' ? updater(ns) : updater,
      edges: es
    })),
    [flowId, updateFlowGraph]
  );

  // ✅ Wrap FlowEditor with FlowTestProvider if testSingleNode is provided
  const flowEditor = (
    <FlowEditor
      flowId={flowId}
      nodes={flow?.nodes || []}
      edges={flow?.edges || []}
      setNodes={setNodes}
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

  const withFlowActions = (
    <FlowActionsProvider
      setNodes={setNodes}
      createFactoryTask={entityCreation.createFactoryTask}
      createBackendCall={entityCreation.createBackendCall}
      createTask={entityCreation.createTask}
      createCondition={entityCreation.createCondition}
    >
      {flowEditor}
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


