import { TreeNodeProps } from './types';

/**
 * Restituisce i nodi visibili per lo step selezionato,
 * escludendo escalation se step = start o success.
 */
export function getFilteredNodes(
  nodes: TreeNodeProps[],
  selectedStep: string | null
): TreeNodeProps[] {
  // Se non c'è uno step selezionato, non mostrare nessun nodo
  // (l'utente deve prima selezionare uno step)
  if (!selectedStep) return [];

  // Nascondi escalation per start e success
  const hideEscalation = ['start', 'success'].includes(selectedStep);

  if (hideEscalation) {
    // Per start e success: mostra solo actions dirette (senza escalation)
    return nodes.filter(n => 
      n.stepType === selectedStep && 
      n.type === selectedStep && 
      n.level === 0 && 
      !n.parentId // Non sono figli di escalation
    );
  } else {
    // Per altri step: mostra escalation e actions figlie
    const escalationNodes = nodes.filter(n => n.type === 'escalation' && n.stepType === selectedStep);
    const escalationIds = escalationNodes.map(n => n.id);
    const childNodes = nodes.filter(n => n.parentId && escalationIds.includes(n.parentId));
    return [...escalationNodes, ...childNodes];
  }
} 