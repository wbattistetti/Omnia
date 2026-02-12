import { useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '@components/Flowchart/types/flowTypes';

interface UseTaskCreationFromSelectionParams {
  nodes: Node<FlowNode>[];
  edges: Edge<EdgeData>[];
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>;
  setEdges: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
  setSelectionMenu: (menu: { show: boolean; x: number; y: number }) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  onCreateTaskFlow?: (
    flowId: string,
    title: string,
    nodes: Node<FlowNode>[],
    edges: Edge<EdgeData>[]
  ) => void;
  onOpenTaskFlow?: (flowId: string, title: string) => void;
}

/**
 * Hook for managing task creation from multiple node selection.
 * Handles the complete flow: hide nodes, create task node, rollback on cancel, finalize on commit.
 */
export function useTaskCreationFromSelection({
  nodes,
  edges,
  setNodes,
  setEdges,
  setSelectionMenu,
  setSelectedNodeIds,
  onCreateTaskFlow,
  onOpenTaskFlow,
}: UseTaskCreationFromSelectionParams) {
  const handleCreateTask = useCallback((selectedNodeIds: string[]) => {
    if (selectedNodeIds.length < 2) return;

    console.log(
      '🎯 [CREATE_TASK] Starting task creation from',
      selectedNodeIds.length,
      'selected nodes'
    );

    // 1. SAVE original selection for rollback
    const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
    const selectedEdges = edges.filter(
      (e) => selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
    );
    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

    // 2. Create unique IDs for task flow and task node
    const newFlowId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const taskNodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const editingToken = `edit_${Date.now()}`; // Immutable token to trigger editing

    console.log('🎯 [CREATE_TASK] Task node will be created at:', {
      x: avgX,
      y: avgY,
      id: taskNodeId,
      flowId: newFlowId,
    });
    console.log('🎯 [CREATE_TASK] Saved original selection:', {
      nodes: selectedNodes.length,
      edges: selectedEdges.length,
    });

    // 3. HIDE selected nodes (but don't delete them yet)
    setNodes((nds) =>
      nds.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, hidden: true } : n))
    );

    // 4. HIDE selected edges
    setEdges((eds) =>
      eds.map((e) =>
        selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
          ? { ...e, hidden: true }
          : e
      )
    );

    // 5. Create Task node in editing mode (DON'T create flow yet)
    const taskNode: Node<any> = {
      id: taskNodeId,
      type: 'task',
      position: { x: avgX, y: avgY },
      data: {
        label: '', // Empty at start, will be edited by user
        flowId: newFlowId,
        editingToken, // Immutable token to trigger immediate editing
        onUpdate: (updates: any) => {
          console.log('🎯 [TASK_UPDATE] Task node data updated:', updates);
          setNodes((nds) =>
            nds.map((n) =>
              n.id === taskNodeId ? { ...n, data: { ...n.data, ...updates } } : n
            )
          );
        },
        onCancelTitle: () => {
          console.log('🎯 [TASK_CANCEL] Task creation cancelled, restoring original selection');

          // ROLLBACK: Remove task node
          setNodes((nds) => nds.filter((n) => n.id !== taskNodeId));

          // ROLLBACK: Restore hidden nodes
          setNodes((nds) =>
            nds.map((n) =>
              selectedNodeIds.includes(n.id) ? { ...n, hidden: false } : n
            )
          );

          // ROLLBACK: Restore hidden edges
          setEdges((eds) =>
            eds.map((e) =>
              selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)
                ? { ...e, hidden: false }
                : e
            )
          );

          console.log('🎯 [TASK_CANCEL] Original selection restored');
        },
        onCommitTitle: (title: string) => {
          console.log('🎯 [TASK_COMMIT] Task title committed:', title);

          // FINALIZE: ONLY NOW delete hidden nodes
          setNodes((nds) => nds.filter((n) => !selectedNodeIds.includes(n.id)));

          // FINALIZE: ONLY NOW delete edges
          setEdges((eds) =>
            eds.filter(
              (e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)
            )
          );

          // FINALIZE: ONLY NOW create flow
          if (onCreateTaskFlow) {
            console.log('🎯 [TASK_COMMIT] Creating task flow:', newFlowId);
            onCreateTaskFlow(newFlowId, title, selectedNodes, selectedEdges);
          }

          // FINALIZE: ONLY NOW open tab
          if (onOpenTaskFlow) {
            console.log('🎯 [TASK_COMMIT] Opening task flow tab:', title);
            onOpenTaskFlow(newFlowId, title);
          }

          console.log('🎯 [TASK_COMMIT] Task finalized successfully');
        },
      },
    };

    console.log('🎯 [CREATE_TASK] Adding task node to flow (in editing mode)');
    setNodes((nds) => [...nds, taskNode]);

    // 6. Close selection menu
    setSelectionMenu({ show: false, x: 0, y: 0 });
    setSelectedNodeIds([]);

    console.log('🎯 [CREATE_TASK] Task node created, waiting for user input');
  }, [
    nodes,
    edges,
    setNodes,
    setEdges,
    setSelectionMenu,
    setSelectedNodeIds,
    onCreateTaskFlow,
    onOpenTaskFlow,
  ]);

  return { handleCreateTask };
}
