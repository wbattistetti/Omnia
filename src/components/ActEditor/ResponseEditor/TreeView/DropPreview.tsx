import React from 'react';
import { DropPreviewProps } from './TreeViewTypes';

const DropPreview: React.FC<DropPreviewProps> = ({
  dropPreviewIdx,
  dropPreviewPosition,
  nodes
}) => {
  if (dropPreviewIdx === null || !dropPreviewPosition) {
    return null;
  }

  const targetNode = nodes[dropPreviewIdx];
  if (!targetNode) {
    return null;
  }

  const calculateTopPosition = () => {
    const nodeElem = document.getElementById('tree-node-' + targetNode.id);
    if (!nodeElem) return 0;

    // Se è un escalation, calcola la posizione basandosi sulle azioni interne
    const childrenNodes = targetNode.type === 'escalation'
      ? nodes.filter(n => n.parentId === targetNode.id).map(child => ({ ...child, level: 1 }))
      : undefined;

    if (targetNode.type === 'escalation' && childrenNodes && childrenNodes.length > 0) {
      // Calcola la posizione basandosi sulla struttura del nodo escalation
      const headerHeight = 40; // Altezza approssimativa dell'header escalation
      const padding = 8;
      const taskHeight = 32; // Altezza approssimativa di ogni TaskRow

      if (dropPreviewPosition === 'before') {
        // Prima azione interna
        const firstAction = childrenNodes[0];
        if (firstAction) {
          return nodeElem.offsetTop + headerHeight + padding - 2;
        }
      } else {
        // Dopo l'ultima azione interna
        const lastAction = childrenNodes[childrenNodes.length - 1];
        if (lastAction) {
          const totalTasksHeight = childrenNodes.length * taskHeight;
          return nodeElem.offsetTop + headerHeight + padding + totalTasksHeight + padding + 2;
        }
      }
    }

    // Fallback: usa il nodo escalation
    if (dropPreviewPosition === 'before') {
      return nodeElem.offsetTop - 2;
    } else {
      return nodeElem.offsetTop + nodeElem.offsetHeight + 2;
    }
  };

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      height: 3,
      background: '#2563eb',
      zIndex: 1000,
      pointerEvents: 'none',
      top: calculateTopPosition()
    }} />
  );
};

export default DropPreview;