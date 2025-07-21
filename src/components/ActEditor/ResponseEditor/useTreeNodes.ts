// Executive summary: Custom React hook for managing the state and logic of response tree nodes.
import { useState, useCallback } from 'react';
import { TreeNodeProps } from './types';

export function useTreeNodes(initialNodes: TreeNodeProps[]) {
  const [nodes, setNodes] = useState<TreeNodeProps[]>(initialNodes);

  const handleDrop = useCallback((targetId: string, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: any) => {
    setNodes(nodes => {
      const targetIndex = nodes.findIndex(node => node.id === targetId);
      const targetNode = nodes[targetIndex];
      const parentNode = nodes.find(node => node.id === targetNode.parentId);
      
      const newNode: TreeNodeProps = {
        id: Math.random().toString(36).substr(2, 9),
        text: draggedData.label,
        type: 'action',
        icon: draggedData.icon,
        color: draggedData.color,
        onDrop: () => {} // placeholder, verrà sovrascritto
      };

      const newNodes = [...nodes];
      
      if (position === 'parent-sibling') {
        const parentLevel = parentNode ? parentNode.level || 0 : 0;
        const parentLastSiblingIndex = [...nodes].reverse().findIndex((node, idx) => {
          const actualIdx = nodes.length - 1 - idx;
          return actualIdx <= targetIndex && (node.level || 0) === parentLevel;
        });
        const insertIndex = nodes.length - parentLastSiblingIndex;
        newNodes.splice(insertIndex, 0, { ...newNode, level: parentLevel, onDrop: handleDrop });
      } else if (position === 'before') {
        newNodes.splice(targetIndex, 0, { ...newNode, level: targetNode.level, onDrop: handleDrop });
      } else if (position === 'after') {
        newNodes.splice(targetIndex + 1, 0, { ...newNode, level: targetNode.level, onDrop: handleDrop });
      } else {
        newNodes.splice(targetIndex + 1, 0, { 
          ...newNode, 
          level: (targetNode.level || 0) + 1,
          parentId: targetNode.id,
          onDrop: handleDrop
        });
      }

      return newNodes;
    });
  }, []);

  const addNode = useCallback((data: any) => {
    setNodes(nodes => [
      ...nodes,
      {
        id: Math.random().toString(36).substr(2, 9),
        text: data.label,
        type: 'action',
        icon: data.icon,
        color: data.color,
        level: 0,
        onDrop: handleDrop
      }
    ]);
  }, [handleDrop]);

  return { nodes, setNodes, handleDrop, addNode };
} 