import React, { createContext, useContext, useMemo, useRef } from 'react';
import type { Node } from 'reactflow';
import type { FlowNode } from '../components/Flowchart/types/flowTypes';
import type { TaskType } from '../types/taskTypes';

/**
 * FlowActionsContext - Phase 1 Refactoring
 *
 * Provides stable action references that don't change on every render.
 * This eliminates the callback recreation problem in FlowEditor.
 *
 * BACKWARD COMPATIBILITY: Components should check if context is available
 * and fall back to data.onDelete/data.onUpdate if not.
 */

export interface FlowActionsContextValue {
  // Node CRUD operations
  deleteNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<FlowNode>) => void;

  // Entity creation operations
  createFactoryTask: (
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry',
    categoryName?: string,
    type?: TaskType
  ) => void;
  createBackendCall: (
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry',
    categoryName?: string
  ) => void;
  createTask: (
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry',
    categoryName?: string
  ) => void;
  createCondition: (
    name: string,
    onRowUpdate?: (item: any) => void,
    scope?: 'global' | 'industry',
    categoryName?: string
  ) => void;
}

const FlowActionsContext = createContext<FlowActionsContextValue | null>(null);

export interface FlowActionsProviderProps {
  children: React.ReactNode;
  setNodes: React.Dispatch<React.SetStateAction<Node<FlowNode>[]>>;
  // Entity creation functions (from useEntityCreation hook)
  createFactoryTask: FlowActionsContextValue['createFactoryTask'];
  createBackendCall: FlowActionsContextValue['createBackendCall'];
  createTask: FlowActionsContextValue['createTask'];
  createCondition: FlowActionsContextValue['createCondition'];
  // Optional: custom delete handler (e.g., deleteNodeWithLog)
  onDeleteNode?: (nodeId: string) => void;
}

export const FlowActionsProvider: React.FC<FlowActionsProviderProps> = ({
  children,
  setNodes,
  createFactoryTask,
  createBackendCall,
  createTask,
  createCondition,
  onDeleteNode,
}) => {
  // Store setNodes in a ref to avoid dependency changes
  const setNodesRef = useRef(setNodes);
  setNodesRef.current = setNodes;

  // Store onDeleteNode in a ref
  const onDeleteNodeRef = useRef(onDeleteNode);
  onDeleteNodeRef.current = onDeleteNode;

  // Create stable action references that NEVER change
  const actions = useMemo<FlowActionsContextValue>(() => ({
    deleteNode: (nodeId: string) => {
      if (onDeleteNodeRef.current) {
        // Use custom delete handler if provided
        onDeleteNodeRef.current(nodeId);
      } else {
        // Default: simple filter
        setNodesRef.current((nds) => nds.filter((n) => n.id !== nodeId));
      }
    },

    updateNode: (nodeId: string, updates: Partial<FlowNode>) => {
      setNodesRef.current((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      );
    },

    // Pass through entity creation functions
    // These are already memoized in useEntityCreation
    createFactoryTask,
    createBackendCall,
    createTask,
    createCondition,
  }), [createFactoryTask, createBackendCall, createTask, createCondition]);

  return (
    <FlowActionsContext.Provider value={actions}>
      {children}
    </FlowActionsContext.Provider>
  );
};

/**
 * Hook to access flow actions from context.
 *
 * IMPORTANT: This hook returns null if used outside FlowActionsProvider.
 * Components should handle this case and fall back to data.onDelete/data.onUpdate.
 *
 * @example
 * const actions = useFlowActions();
 * // With fallback:
 * const handleDelete = () => {
 *   if (actions?.deleteNode) {
 *     actions.deleteNode(nodeId);
 *   } else if (data.onDelete) {
 *     data.onDelete();
 *   }
 * };
 */
export function useFlowActions(): FlowActionsContextValue | null {
  return useContext(FlowActionsContext);
}

/**
 * Hook that throws if used outside FlowActionsProvider.
 * Use this only when you're certain the provider exists.
 */
export function useFlowActionsStrict(): FlowActionsContextValue {
  const context = useContext(FlowActionsContext);
  if (!context) {
    throw new Error('useFlowActionsStrict must be used within FlowActionsProvider');
  }
  return context;
}
