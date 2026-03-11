// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { useCallback } from 'react';
import { Node, ReactFlowInstance } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { FlowNode } from '../components/Flowchart/types/flowTypes';
import { taskRepository } from '../services/TaskRepository';
import { getTaskIdFromRow } from '../utils/taskHelpers';

/**
 * useNodeActions - Phase 3 Refactoring
 *
 * Extracts enhanced node CRUD operations from FlowEditor.tsx.
 * Provides task-aware node deletion and position-aware node creation.
 *
 * RESPONSIBILITIES:
 * - Delete nodes with task cleanup (deleteNodeWithLog)
 * - Create nodes at specific positions (createNodeAt)
 *
 * DOES NOT HANDLE:
 * - Basic node CRUD (use useNodeManager)
 * - Node state management (managed by FlowEditor)
 */

export interface UseNodeActionsDeps {
  /** Current nodes array */
  nodes: Node<FlowNode>[];
  /** Basic delete node function from useNodeManager */
  deleteNode: (nodeId: string) => void;
  /** Basic add node at position from useNodeManager */
  addNodeAtPosition: (node: Node<FlowNode>, x: number, y: number) => void;
  /** Update node function from useNodeManager */
  updateNode: (nodeId: string, updates: Partial<FlowNode>) => void;
  /** React Flow instance for coordinate conversion */
  reactFlowInstance: ReactFlowInstance | null;
  /** Project ID for task repository operations */
  projectId?: string;
}

export interface UseNodeActionsResult {
  /** Delete node with task cleanup */
  deleteNodeWithLog: (nodeId: string) => Promise<void>;
  /** Create node at screen position */
  createNodeAt: (clientX: number, clientY: number, initialRow?: any) => void;
}

/**
 * Hook for enhanced node operations.
 * Extracted from FlowEditor.tsx to reduce complexity.
 */
export function useNodeActions(deps: UseNodeActionsDeps): UseNodeActionsResult {
  const {
    nodes,
    deleteNode,
    addNodeAtPosition,
    updateNode,
    reactFlowInstance,
    projectId,
  } = deps;

  /**
   * Delete node with task cleanup.
   * Deletes all tasks associated with the node's rows before deleting the node.
   */
  const deleteNodeWithLog = useCallback(async (nodeId: string) => {
    try {
      // Find the node before deleting
      const nodeToDelete = nodes.find(n => n.id === nodeId);

      if (nodeToDelete && nodeToDelete.data?.rows) {
        const rows = nodeToDelete.data.rows as any[];
        console.log(`[useNodeActions] Deleting node ${nodeId} with ${rows.length} rows`);

        // Delete all tasks for rows
        for (const row of rows) {
          const taskId = row?.taskId || getTaskIdFromRow(row) || row?.id;
          if (taskId) {
            try {
              await taskRepository.deleteTask(taskId, projectId);
              console.log(`[useNodeActions] Task ${taskId} deleted for row ${row.id}`);

              // Emit event to close Response Editor if open for this task
              document.dispatchEvent(new CustomEvent('taskEditor:closeIfOpen', {
                detail: { taskId }
              }));
            } catch (e) {
              console.warn(`[useNodeActions] Error deleting task ${taskId}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('[useNodeActions] Error during task deletion:', e);
    }

    // Delete the node
    deleteNode(nodeId);
  }, [deleteNode, nodes, projectId]);

  /**
   * Create node at screen position.
   * Converts screen coordinates to flow coordinates and creates a new node.
   */
  const createNodeAt = useCallback((clientX: number, clientY: number, initialRow?: any) => {
    // Use UUID instead of counter to avoid conflicts
    const newNodeId = uuidv4();

    let x = 0, y = 0;
    if (reactFlowInstance) {
      // Convert screen coordinates to flow coordinates
      const pos = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
      x = pos.x;
      y = pos.y;
    }

    // ✅ VERIFY: Controlla che il task esista quando si crea un nuovo nodo con una riga
    if (initialRow && initialRow.id) {
      const taskId = initialRow.id; // row.id === task.id
      const task = taskRepository.getTask(taskId);

      console.log('[useNodeActions] 🔍 CREATE NODE FROM ROW - Task verification', {
        rowId: initialRow.id,
        taskId: taskId,
        taskExists: !!task,
        taskType: task?.type,
        newNodeId: newNodeId,
        action: 'creating new node with row',
        rowData: {
          id: initialRow.id,
          text: initialRow.text,
          taskId: initialRow.taskId,
          instanceId: initialRow.instanceId
        }
      });
    }

    const focusRowId = initialRow ? initialRow.id : `${newNodeId}-${Math.random().toString(36).substr(2, 9)}`;

    const node: Node<FlowNode> = {
      id: newNodeId,
      type: 'custom',
      position: { x, y },
      data: {
        label: '',
        rows: initialRow ? [initialRow] : [],
        // Callbacks will be injected by FlowEditor's useEffect
        onDelete: () => deleteNodeWithLog(newNodeId),
        onUpdate: (updates: any) => updateNode(newNodeId, updates),
        hidden: false,
        focusRowId: focusRowId,
        isTemporary: true,
      },
    };

    addNodeAtPosition(node, x, y);
  }, [addNodeAtPosition, reactFlowInstance, deleteNodeWithLog, updateNode]);

  return {
    deleteNodeWithLog,
    createNodeAt,
  };
}
