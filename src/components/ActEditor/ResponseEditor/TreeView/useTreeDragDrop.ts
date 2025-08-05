import { useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { TreeNodeProps } from '../types';
import { UseTreeDragDropProps, UseTreeDragDropReturn } from './TreeViewTypes';

export const useTreeDragDrop = ({
  nodes,
  onDrop,
  containerRef,
  setSelectedNodeId
}: UseTreeDragDropProps): UseTreeDragDropReturn => {
  const [dropPreviewIdx, setDropPreviewIdx] = useState<number | null>(null);
  const [dropPreviewPosition, setDropPreviewPosition] = useState<'before' | 'after' | null>(null);

  // Debug logging
  useEffect(() => {
    console.log(`[TREEVIEW DEBUG] dropPreviewIdx=${dropPreviewIdx}, dropPreviewPosition=${dropPreviewPosition}`);
    if (dropPreviewIdx !== null && nodes[dropPreviewIdx]) {
      console.log(`[TREEVIEW DEBUG] Target node:`, nodes[dropPreviewIdx]);
    }
  }, [dropPreviewIdx, dropPreviewPosition, nodes]);

  // Drop su canvas (aggiungi come root)
  const [{ isOver }, dropRef] = useDrop({
    accept: 'ACTION',
    drop(item: any, monitor) {
      if (item && typeof item === 'object') {
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          return;
        }
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          return;
        }
        const y = clientOffset.y - containerRect.top;
        
        // Trova il nodo più vicino al punto di drop
        let closestIdx = -1;
        let minDist = Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        nodes.forEach((node, idx) => {
          const nodeElem = document.getElementById('tree-node-' + node.id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            if (centerY < minY) minY = centerY;
            if (centerY > maxY) maxY = centerY;
            const dist = Math.abs(centerY - y);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          }
        });
        
        // Se non ci sono nodi, aggiungi come root
        if (nodes.length === 0) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          onDrop(null, 'after', item);
          setSelectedNodeId(null);
          return;
        }
        
        // Se il punto di drop è sopra il primo nodo o sotto l'ultimo nodo, aggiungi come root
        if (y < minY - 16 || y > maxY + 16) { // 16px di tolleranza
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          onDrop(null, 'after', item);
          setSelectedNodeId(null);
          return;
        }
        
        // Altrimenti, drop tra i nodi
        let position: 'before' | 'after' | 'child' = 'after';
        if (closestIdx !== -1) {
          const nodeElem = document.getElementById('tree-node-' + nodes[closestIdx].id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            position = y < centerY ? 'before' : 'after';
            setDropPreviewIdx(closestIdx);
            setDropPreviewPosition(position);
            const result = onDrop(nodes[closestIdx].id, position, item);
            setDropPreviewIdx(null);
            setDropPreviewPosition(null);
            if (typeof result === 'string') {
              setSelectedNodeId(result);
            } else {
              setSelectedNodeId(nodes[closestIdx].id);
            }
            return;
          }
        }
        setDropPreviewIdx(null);
        setDropPreviewPosition(null);
      }
    },
    hover(item, monitor) {
      // Debug per capire il tipo di drag
      console.log(`[DRAG DEBUG] Item being dragged:`, item);
      console.log(`[DRAG DEBUG] Item type:`, item?.type);
      console.log(`[DRAG DEBUG] Item id:`, item?.id);
      
      // Distingui tra nuova azione e azione esistente
      const isNewAction = item?.action; // Nuova azione ha 'action' property
      const isExistingAction = item?.id && !item?.action; // Azione esistente ha solo 'id'
      
      console.log(`[DRAG DEBUG] Is new action:`, isNewAction);
      console.log(`[DRAG DEBUG] Is existing action:`, isExistingAction);
      
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) {
        setDropPreviewIdx(null);
        setDropPreviewPosition(null);
        return;
      }
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) {
        setDropPreviewIdx(null);
        setDropPreviewPosition(null);
        return;
      }
      const y = clientOffset.y - containerRect.top;
      
      // LOGICA SPECIFICA PER NUOVE AZIONI
      if (isNewAction) {
        console.log(`[DRAG DEBUG] Handling NEW ACTION drag`);
        
        // Trova il nodo più vicino
        let closestIdx = -1;
        let minDist = Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        nodes.forEach((node, idx) => {
          const nodeElem = document.getElementById('tree-node-' + node.id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            if (centerY < minY) minY = centerY;
            if (centerY > maxY) maxY = centerY;
            const dist = Math.abs(centerY - y);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          }
        });
        
        if (nodes.length === 0) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          return;
        }
        if (y < minY - 16 || y > maxY + 16) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          return;
        }
        
        if (closestIdx !== -1) {
          const targetNode = nodes[closestIdx];
          const nodeElem = document.getElementById('tree-node-' + targetNode.id);
          
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            const position = y < centerY ? 'before' : 'after';
            
            // REGOLA 4: Se è un escalation e stiamo trascinando sopra lo spazio tra due recovery, non mostrare preview
            if (targetNode.type === 'escalation') {
              // Calcola se siamo nello spazio tra recovery (non dentro un recovery)
              const headerHeight = 40;
              const padding = 8;
              const nodeTop = nodeElem.offsetTop;
              const nodeHeight = nodeElem.offsetHeight;
              const headerBottom = nodeTop + headerHeight + padding;
              const nodeBottom = nodeTop + nodeHeight;
              
              // Se siamo sopra l'header o sotto il nodo, non mostrare preview
              if (y < headerBottom || y > nodeBottom) {
                console.log(`[DRAG DEBUG] Between escalations - no preview`);
                setDropPreviewIdx(null);
                setDropPreviewPosition(null);
                return;
              }
            }
            
            // REGOLA 1-3: Mostra preview per azioni dentro recovery
            console.log(`[DRAG DEBUG] Showing preview for new action at node ${targetNode.id}, position: ${position}`);
            setDropPreviewIdx(closestIdx);
            setDropPreviewPosition(position);
            return;
          }
        }
      }
      
      // LOGICA SPECIFICA PER AZIONI ESISTENTI (REORDERING)
      if (isExistingAction) {
        console.log(`[DRAG DEBUG] Handling EXISTING ACTION reordering`);
        
        // Per reordering, permette preview ovunque tranne tra escalation
        let closestIdx = -1;
        let minDist = Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        nodes.forEach((node, idx) => {
          const nodeElem = document.getElementById('tree-node-' + node.id);
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            if (centerY < minY) minY = centerY;
            if (centerY > maxY) maxY = centerY;
            const dist = Math.abs(centerY - y);
            if (dist < minDist) {
              minDist = dist;
              closestIdx = idx;
            }
          }
        });
        
        if (nodes.length === 0) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          return;
        }
        if (y < minY - 16 || y > maxY + 16) {
          setDropPreviewIdx(null);
          setDropPreviewPosition(null);
          return;
        }
        
        if (closestIdx !== -1) {
          const targetNode = nodes[closestIdx];
          const nodeElem = document.getElementById('tree-node-' + targetNode.id);
          
          if (nodeElem) {
            const rect = nodeElem.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2 - containerRect.top;
            const position = y < centerY ? 'before' : 'after';
            
            // Per reordering, mostra sempre preview (anche tra escalation)
            console.log(`[DRAG DEBUG] Showing preview for existing action reordering at node ${targetNode.id}, position: ${position}`);
            setDropPreviewIdx(closestIdx);
            setDropPreviewPosition(position);
            return;
          }
        }
      }
      
      setDropPreviewIdx(null);
      setDropPreviewPosition(null);
    },
    collect: monitor => ({
      isOver: monitor.isOver({ shallow: true })
    })
  });

  return {
    isOver,
    dropPreviewIdx,
    dropPreviewPosition,
    setDropPreviewIdx,
    setDropPreviewPosition
  };
}; 