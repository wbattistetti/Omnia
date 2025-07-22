// Executive summary: Custom React hook for managing the state and logic of response tree nodes.
import { useState, useCallback } from 'react';
import { TreeNodeProps } from './types';

const getString = (val: any) => {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) return val['it'] || val['en'] || Object.values(val)[0] || '';
  return '';
};

export function useTreeNodes(initialNodes: TreeNodeProps[]) {
  const [nodes, setNodes] = useState<TreeNodeProps[]>(initialNodes);

  // Permetti targetId null per drop su canvas
  const handleDrop = useCallback((targetId: string | null, position: 'before' | 'after' | 'child' | 'parent-sibling', draggedData: any) => {
    let newId = null;
    setNodes(nodes => {
      const id = Math.random().toString(36).substr(2, 9);
      const newNode: TreeNodeProps = {
        id,
        text: getString(draggedData.label),
        type: 'action',
        icon: draggedData.icon,
        color: draggedData.color,
        label: getString(draggedData.label),
        primaryValue: getString(draggedData.primaryValue),
        parameters: Array.isArray(draggedData.parameters)
          ? draggedData.parameters.map((p: any) => ({ key: p.key, value: getString(p.value) }))
          : undefined,
        onDrop: () => {} // placeholder, verrà sovrascritto
      };
      let newNodes = [...nodes];
      if (targetId === null) {
        // Drop su canvas: aggiungi in fondo come root sibling
        newNodes.push({ ...newNode, level: 0, parentId: undefined, onDrop: handleDrop });
      } else {
        const targetIndex = nodes.findIndex(node => node.id === targetId);
        const targetNode = nodes[targetIndex];
        const parentNode = nodes.find(node => node.id === targetNode.parentId);
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
      }
      newId = id;
      return newNodes;
    });
    return newId;
  }, []);

  // Modifica: ritorna l'id del nuovo nodo creato
  const addNode = useCallback((data: any) => {
    const newId = Math.random().toString(36).substr(2, 9);
    setNodes(nodes => {
      const newNode = {
        id: newId,
        text: getString(data.label),
        type: 'action' as const,
        icon: data.icon,
        color: data.color,
        label: getString(data.label),
        primaryValue: getString(data.primaryValue),
        parameters: Array.isArray(data.parameters)
          ? data.parameters.map((p: any) => ({ key: p.key, value: getString(p.value) }))
          : undefined,
        level: 0, // sibling del root
        parentId: undefined, // nessun parent
        onDrop: handleDrop
      };
      return [...nodes, newNode];
    });
    return newId;
  }, [handleDrop]);

  // Nuova funzione per rimuovere un nodo per id
  const removeNode = useCallback((id: string) => {
    setNodes(nodes => nodes.filter(node => node.id !== id));
  }, []);

  return { nodes, setNodes, handleDrop, addNode, removeNode };
} 