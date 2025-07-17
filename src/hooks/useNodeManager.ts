import { useCallback, Dispatch, SetStateAction } from 'react';
import { Node } from 'reactflow';

// Tipo base per i dati custom del nodo
export type NodeData = {
  title: string;
  rows: Array<{ id: string; text: string; [key: string]: any }>;
  isTemporary?: boolean;
  onDelete?: () => void;
  onUpdate?: (updates: any) => void;
  [key: string]: any;
};

export function useNodeManager(
  setNodes: Dispatch<SetStateAction<Node<NodeData>[]>>,
  setNodeIdCounter: Dispatch<SetStateAction<number>>
) {
  /**
   * Aggiungi un nodo
   */
  const addNode = useCallback((node: Node<NodeData>) => {
    setNodes((nds) => [...nds, node]);
    setNodeIdCounter((prev) => prev + 1);
  }, [setNodes, setNodeIdCounter]);

  /**
   * Cancella un nodo per id
   */
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
  }, [setNodes]);

  /**
   * Aggiorna un nodo per id
   */
  const updateNode = useCallback((nodeId: string, updates: Partial<NodeData>) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
      )
    );
  }, [setNodes]);

  /**
   * Aggiungi un nodo a una posizione specifica
   */
  const addNodeAtPosition = useCallback((node: Node<NodeData>, x: number, y: number) => {
    setNodes((nds) => [
      ...nds,
      { ...node, position: { x, y } }
    ]);
    setNodeIdCounter((prev) => prev + 1);
  }, [setNodes, setNodeIdCounter]);

  return { addNode, deleteNode, updateNode, addNodeAtPosition };
} 