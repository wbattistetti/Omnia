import { useCallback, Dispatch, SetStateAction } from 'react';
import { Node } from 'reactflow';
import { FlowNode } from '../components/Flowchart/types/flowTypes';

export function useNodeManager(
  setNodes: Dispatch<SetStateAction<Node<FlowNode>[]>>,
  setNodeIdCounter: Dispatch<SetStateAction<number>>
) {
  /**
   * Aggiungi un nodo
   */
  const addNode = useCallback((node: Node<FlowNode>) => {
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
  const updateNode = useCallback((nodeId: string, updates: Partial<FlowNode>) => {
    // Removed verbose log

    setNodes((nds) => {
      const updatedNodes = nds.map((node) => {
        if (node.id === nodeId) {
          const oldPosition = node.position;
          const updatedNode = { ...node, data: { ...node.data, ...updates } };


          return updatedNode;
        }
        return node;
      });
      return updatedNodes;
    });
  }, [setNodes]);

  /**
   * Aggiungi un nodo a una posizione specifica
   */
  const addNodeAtPosition = useCallback((node: Node<FlowNode>, x: number, y: number) => {
    setNodes((nds) => [
      ...nds,
      { ...node, position: { x, y } }
    ]);
    setNodeIdCounter((prev) => prev + 1);
  }, [setNodes, setNodeIdCounter]);

  return { addNode, deleteNode, updateNode, addNodeAtPosition };
}