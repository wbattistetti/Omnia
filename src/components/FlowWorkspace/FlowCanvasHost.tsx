import React, { useEffect, useCallback } from 'react';
import { useFlowWorkspace, useFlowActions as useFlowStoreActions } from '../../flows/FlowStore.tsx';
import { loadFlow } from '../../flows/FlowPersistence';
import { FlowEditor } from '../Flowchart/FlowEditor';
import { FlowVariablesRail } from './FlowVariablesRail';
import { dlog } from '../../utils/debug';
import { useProjectDataUpdate } from '../../context/ProjectDataContext';
import { FlowTestProvider } from '../../context/FlowTestContext';
import { FlowActionsProvider } from '../../context/FlowActionsContext';
import { useEntityCreation } from '../../hooks/useEntityCreation';

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
  const { upsertFlow, updateFlowGraph } = useFlowStoreActions();
  const pd = useProjectDataUpdate();

  const entityCreation = useEntityCreation();

  useEffect(() => {
    if (!projectId) {
      if (!flows[flowId]) {
        upsertFlow({ id: flowId, title: flowId === 'main' ? 'Main' : flowId, nodes: [], edges: [] });
      }
      return;
    }
    (async () => {
      if (!flows[flowId] || (!flows[flowId].nodes?.length && !flows[flowId].edges?.length)) {
        const data = await loadFlow(projectId, flowId);
        upsertFlow({
          id: flowId,
          title: flowId === 'main' ? 'Main' : flowId,
          nodes: data.nodes,
          edges: data.edges,
          ...(data.meta !== undefined
            ? { meta: { ...flows[flowId]?.meta, ...data.meta } }
            : {}),
        });
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
      <div className="relative flex flex-1 min-h-0 w-full h-full flex-col">
        <div className="flex-1 min-h-0">{flowEditor}</div>
        <FlowVariablesRail flowId={flowId} />
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


