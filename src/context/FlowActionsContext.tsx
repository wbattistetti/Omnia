import React, { createContext, useContext, useMemo, useRef } from 'react';
import type { Node, Edge } from 'reactflow';
import type { FlowNode, EdgeData } from '../components/Flowchart/types/flowTypes';
import { mergeEdgePatch } from '../components/Flowchart/utils/mergeEdgePatch';
import type { TaskType } from '../types/taskTypes';

/**
 * FlowActionsContext - Centralized flow operations
 *
 * Provides stable action references that don't change on every render.
 * This eliminates the callback recreation problem in FlowEditor.
 *
 * Supports both node and edge operations.
 */

export interface FlowActionsContextValue {
  // Node CRUD operations
  deleteNode: (nodeId: string) => void;
  updateNode: (nodeId: string, updates: Partial<FlowNode>) => void;

  // Edge CRUD operations
  deleteEdge: (edgeId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<EdgeData>) => void;

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
  setEdges?: React.Dispatch<React.SetStateAction<Edge<EdgeData>[]>>;
  // Entity creation functions (from useEntityCreation hook)
  createFactoryTask: FlowActionsContextValue['createFactoryTask'];
  createBackendCall: FlowActionsContextValue['createBackendCall'];
  createTask: FlowActionsContextValue['createTask'];
  createCondition: FlowActionsContextValue['createCondition'];
  // Optional: custom delete handlers
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
}

export const FlowActionsProvider: React.FC<FlowActionsProviderProps> = ({
  children,
  setNodes,
  setEdges,
  createFactoryTask,
  createBackendCall,
  createTask,
  createCondition,
  onDeleteNode,
  onDeleteEdge,
}) => {
  // Store setters in refs to avoid dependency changes
  const setNodesRef = useRef(setNodes);
  setNodesRef.current = setNodes;

  const setEdgesRef = useRef(setEdges);
  setEdgesRef.current = setEdges;

  // Store custom handlers in refs
  const onDeleteNodeRef = useRef(onDeleteNode);
  onDeleteNodeRef.current = onDeleteNode;

  const onDeleteEdgeRef = useRef(onDeleteEdge);
  onDeleteEdgeRef.current = onDeleteEdge;

  // Create stable action references that NEVER change
  const actions = useMemo<FlowActionsContextValue>(() => ({
    // Node operations
    deleteNode: (nodeId: string) => {
      if (onDeleteNodeRef.current) {
        onDeleteNodeRef.current(nodeId);
      } else {
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

    // Edge operations
    deleteEdge: (edgeId: string) => {
      if (onDeleteEdgeRef.current) {
        onDeleteEdgeRef.current(edgeId);
      } else if (setEdgesRef.current) {
        setEdgesRef.current((eds) => eds.filter((e) => e.id !== edgeId));
      }
    },

    updateEdge: (edgeId: string, updates: Partial<EdgeData>) => {
      if (setEdgesRef.current) {
        setEdgesRef.current((eds) =>
          eds.map((edge) =>
            edge.id === edgeId ? mergeEdgePatch(edge, updates as Record<string, any>) : edge
          )
        );
      }
    },

    // Entity creation functions (already memoized in useEntityCreation)
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
 * Hook to access flow actions from context (nullable).
 * Prefer {@link useFlowActionsStrict} under {@link FlowActionsProvider}; graph edits must not use `data.onUpdate`.
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
