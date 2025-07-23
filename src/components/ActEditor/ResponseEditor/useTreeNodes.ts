// Executive summary: Custom React hook for managing the state and logic of response tree nodes.
import { useState, useCallback } from 'react';
import { TreeNodeProps } from './types';

console.log('[FILE][useTreeNodes] loaded');

const getString = (val: any) => {
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null) return val['it'] || val['en'] || Object.values(val)[0] || '';
  return '';
};

export function useTreeNodes(initialNodes: TreeNodeProps[]) {
  console.log('[HOOK][useTreeNodes] called', { initialNodes });
  const [nodes, setNodes] = useState<TreeNodeProps[]>(initialNodes);

  // Permetti targetId null per drop su canvas
  const handleDrop = useCallback((targetId: string | null, position: 'before' | 'after' | 'child' | 'parent-sibling', item: any) => {
    console.log('[CALL][handleDrop]', { targetId, position, item });
    let newId = null;
    console.log('[handleDrop] CALLED', { targetId, position, item });
    setNodes(nodes => {
      console.log('[CALLBACK][setNodes]', { nodes });
      console.log('[handleDrop] setNodes IN', { nodes });
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
          console.log('[handleDrop] MOVE: sposto nodo e figli', { nodeToMove, descendants });
          let targetIndex = newNodes.findIndex(node => node.id === targetId);
          if (targetIndex === -1 && targetId === null) {
            // Drop su canvas vuoto
            newNodes.push({ ...nodeToMove, level: 0, parentId: undefined });
            // Sposta anche i figli come root mantenendo la gerarchia
            descendants.forEach(desc => {
              newNodes.push({ ...desc });
            });
            console.log('[handleDrop] DROP SU CANVAS: spostato nodo esistente come root', { nodeToMove, descendants });
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
          console.log('[handleDrop] AFTER MOVE', { newNodes });
          newNodes.forEach(n => console.log('[handleDrop] NODE', { id: n.id, parentId: n.parentId, level: n.level, text: n.text }));
        } else {
          console.warn('[handleDrop] MOVE: nodo da spostare non trovato', { item });
        }
        return newNodes;
      }
      // Creazione nuovo nodo da palette
      if (item && item.action) {
        const action = item.action;
        const id = Math.random().toString(36).substr(2, 9);
        const newNode: TreeNodeProps = {
          id,
          text: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
          type: 'action',
          icon: item.icon,
          color: item.color,
          label: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
          primaryValue: item.primaryValue,
          parameters: item.parameters,
          onDrop: () => {}
        };
        let newNodes = [...nodes];
        if (targetId === null) {
          newNodes.push({ ...newNode, level: 0, parentId: undefined });
          console.log('[handleDrop] DROP SU CANVAS: aggiunto nuovo nodo root', { newNode });
        } else {
          const targetIndex = newNodes.findIndex(node => node.id === targetId);
          const targetNode = newNodes[targetIndex];
          console.log('[handleDrop] NEW NODE', { targetIndex, targetNode, position });
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
        console.log('[handleDrop] AFTER NEW NODE', { newNodes });
        newNodes.forEach(n => console.log('[handleDrop] NODE', { id: n.id, parentId: n.parentId, level: n.level, text: n.text }));
        return newNodes;
      }
      // Caso fallback
      console.warn('[handleDrop] DROP ignorato: item non valido', { item });
      return nodes;
    });
    console.log('[handleDrop] RETURN', { newId });
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