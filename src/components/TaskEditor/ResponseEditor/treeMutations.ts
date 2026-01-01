// Funzioni pure per la manipolazione dell'albero dei nodi (TreeNodeProps)
import { TreeNodeProps } from './types';

// Inserisce un nodo nell'array subito prima o dopo il targetId, mantenendo parentId e level
export function insertNodeAt(nodes: TreeNodeProps[], newNode: TreeNodeProps, targetId: string, position: 'before' | 'after'): TreeNodeProps[] {
  const idx = nodes.findIndex(n => n.id === targetId);
  if (idx === -1) return [...nodes, newNode];
  const before = position === 'before';
  const target = nodes[idx];
  const siblings = nodes.filter(n => n.parentId === target.parentId && n.level === target.level);
  const result: TreeNodeProps[] = [];
  let inserted = false;
  for (let n of nodes) {
    if (n.parentId === target.parentId && n.level === target.level && siblings.includes(n)) {
      if (!inserted && n.id === targetId && before) {
        result.push(newNode);
        inserted = true;
      }
      result.push(n);
      if (!inserted && n.id === targetId && !before) {
        result.push(newNode);
        inserted = true;
      }
    } else {
      result.push(n);
    }
  }
  if (!inserted) result.push(newNode);
  return result;
}

// Aggiunge un nodo come root
export function addNode(nodes: TreeNodeProps[], node: TreeNodeProps): TreeNodeProps[] {
  return [...nodes, node];
}

// Rimuove un nodo (e opzionalmente i figli se escalation)
export function removeNode(nodes: TreeNodeProps[], id: string, removeChildren = false): TreeNodeProps[] {
  if (!removeChildren) return nodes.filter(n => n.id !== id);
  // Se escalation, elimina anche i figli
  return nodes.filter(n => n.id !== id && n.parentId !== id);
}

// Sposta un nodo (da implementare se serve)
export function moveNode(nodes: TreeNodeProps[], nodeId: string, targetId: string, position: 'before' | 'after' | 'child'): TreeNodeProps[] {
  // TODO: implementare logica di spostamento
  return nodes;
} 