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
  const handleDrop = useCallback((targetId: string | null, position: 'before' | 'after' | 'child' | 'parent-sibling', item: any) => {
    let newId = null;
    setNodes(nodes => {
      // Spostamento nodo esistente
      if (item && item.id) {
        const draggedNodeIndex = nodes.findIndex(n => n.id === item.id);
        let newNodes = [...nodes];
        let nodeToMove = null;
        if (draggedNodeIndex !== -1) {
          nodeToMove = { ...newNodes[draggedNodeIndex] };
          // Trova tutti i figli (ricorsivo)
          const getAllDescendants = (id: string) => {
            const directChildren = newNodes.filter(n => n.parentId === id);
            return directChildren.flatMap(child => [child, ...getAllDescendants(child.id)]);
          };
          const descendants = getAllDescendants(nodeToMove.id);
          // Rimuovi nodo e figli
          newNodes = newNodes.filter(n => n.id !== nodeToMove.id && !descendants.some(d => d.id === n.id));
          let targetIndex = newNodes.findIndex(node => node.id === targetId);
          if (targetIndex === -1 && targetId === null) {
            // Drop su canvas vuoto
            newNodes.push({ ...nodeToMove, level: 0, parentId: undefined });
            // Sposta anche i figli come root mantenendo la gerarchia
            descendants.forEach(desc => {
              newNodes.push({ ...desc });
            });
          } else if (position === 'before') {
            newNodes.splice(targetIndex, 0, { ...nodeToMove, level: newNodes[targetIndex].level, parentId: newNodes[targetIndex].parentId });
            descendants.forEach(desc => {
              newNodes.push({ ...desc });
            });
          } else if (position === 'after') {
            newNodes.splice(targetIndex + 1, 0, { ...nodeToMove, level: newNodes[targetIndex].level, parentId: newNodes[targetIndex].parentId });
            descendants.forEach(desc => {
              newNodes.push({ ...desc });
            });
          } else if (position === 'child') {
            newNodes.splice(targetIndex + 1, 0, { ...nodeToMove, level: (newNodes[targetIndex].level || 0) + 1, parentId: newNodes[targetIndex].id });
            descendants.forEach(desc => {
              newNodes.push({ ...desc });
            });
          } else if (position === 'parent-sibling') {
            newNodes.splice(targetIndex + 1, 0, { ...nodeToMove, level: 0, parentId: undefined });
            descendants.forEach(desc => {
              newNodes.push({ ...desc });
            });
          }
          newId = nodeToMove.id;
          newNodes.forEach(n => console.log('[handleDrop] NODE', { id: n.id, parentId: n.parentId, level: n.level, text: n.text }));
        } else {
          console.warn('[handleDrop] MOVE: nodo da spostare non trovato', { item });
        }
        return newNodes;
      }
      // Creazione nuovo nodo da palette
      if (item && item.task) {
        const task = item.task;
        const id = Math.random().toString(36).substr(2, 9);
        const newNode: TreeNodeProps = {
          id,
          text: typeof task.label === 'object' ? task.label.it || task.label.en || task.id : task.label,
          type: 'task',
          icon: item.icon,
          color: item.color,
          label: typeof task.label === 'object' ? task.label.it || task.label.en || task.id : task.label,
          primaryValue: item.primaryValue,
          parameters: item.parameters,
          onDrop: () => {}
        };
        let newNodes = [...nodes];
        if (targetId === null) {
          newNodes.push({ ...newNode, level: 0, parentId: undefined });
        } else {
          const targetIndex = newNodes.findIndex(node => node.id === targetId);
          const targetNode = newNodes[targetIndex];
          if (position === 'before') {
            newNodes.splice(targetIndex, 0, { ...newNode, level: targetNode.level, parentId: targetNode.parentId });
          } else if (position === 'after') {
            newNodes.splice(targetIndex + 1, 0, { ...newNode, level: targetNode.level, parentId: targetNode.parentId });
          } else if (position === 'child') {
            newNodes.splice(targetIndex + 1, 0, { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id });
          } else if (position === 'parent-sibling') {
            newNodes.splice(targetIndex + 1, 0, { ...newNode, level: 0, parentId: undefined });
          }
        }
        newId = id;
        newNodes.forEach(n => console.log('[handleDrop] NODE', { id: n.id, parentId: n.parentId, level: n.level, text: n.text }));
        return newNodes;
      }
      // Caso fallback
      console.warn('[handleDrop] DROP ignorato: item non valido', { item });
      return nodes;
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
        type: 'task' as const,
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