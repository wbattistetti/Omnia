import { TreeNodeProps } from './types';
import { createAction } from './actionFactories';
import { createParameter } from './parameterFactories';
import { insertNodeAt } from './treeFactories';

interface DropParams {
  editorNodes: TreeNodeProps[];
  targetId: string | null;
  position: 'before' | 'after' | 'child';
  item: any;
  selectedStep: string | null;
  dispatch: (action: any) => void;
}

export function handleDropWithInsert({
  editorNodes,
  targetId,
  position,
  item,
  selectedStep,
  dispatch,
}: DropParams) {
  console.log('[DND][handleDrop] called with:', { targetId, position, item });
  console.log('[DND][handleDrop] nodes before:', editorNodes);
  console.log('[DND][handleDrop] selectedStep:', selectedStep);
  
  if (!item) {
    console.error('[DND][handleDrop] No item provided');
    return null;
  }
  
  if (!item.action) {
    console.error('[DND][handleDrop] Item has no action property:', item);
    return null;
  }

  const action = item.action;
  const id = Math.random().toString(36).substr(2, 9);

  console.log('[DND][handleDrop] Creating new node with action:', action);

  const newNode: TreeNodeProps = createAction({
    id,
    text: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
    type: 'action',
    icon: item.icon,
    color: item.color,
    label: typeof action.label === 'object' ? action.label.it || action.label.en || action.id : action.label,
    primaryValue: item.primaryValue,
    parameters: item.parameters ? item.parameters.map(createParameter) : undefined,
  });

  console.log('[DND][handleDrop] Created new node:', newNode);

  if (targetId === null) {
    console.log('[DND][handleDrop] ADD_NODE as root');
    const nodeToAdd = { ...newNode, level: 0, parentId: undefined };
    console.log('[DND][handleDrop] Dispatching ADD_NODE with node:', nodeToAdd);
    dispatch({ type: 'ADD_NODE', node: nodeToAdd });
    return id;
  }

  const targetNode = editorNodes.find(n => n.id === targetId);
  console.log('[DND][handleDrop] targetNode:', targetNode);
  
  if (!targetNode) {
    console.log('[DND][handleDrop] targetNode not found, ADD_NODE as root');
    const nodeToAdd = { ...newNode, level: 0, parentId: undefined };
    console.log('[DND][handleDrop] Dispatching ADD_NODE with node:', nodeToAdd);
    dispatch({ type: 'ADD_NODE', node: nodeToAdd });
    return id;
  }

  if (targetNode.type === 'escalation' && position === 'child') {
    console.log('[DND][handleDrop] ADD_NODE as child of escalation');
    const nodeToAdd = { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id };
    console.log('[DND][handleDrop] Dispatching ADD_NODE with node:', nodeToAdd);
    dispatch({ type: 'ADD_NODE', node: nodeToAdd });
    return id;
  }

  if (targetNode.type === 'escalation' && (position === 'before' || position === 'after')) {
    console.log('[DND][handleDrop] insertNodeAt escalation', position);
    const inserted = insertNodeAt(editorNodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, position);
    console.log('[DND][handleDrop] nodes after insertNodeAt:', inserted);
    console.log('[DND][handleDrop] Dispatching SET_NODES with nodes:', inserted);
    dispatch({ type: 'SET_NODES', nodes: inserted });
    return id;
  }

  if (targetNode.type === 'action') {
    const pos: 'before' | 'after' = position === 'before' ? 'before' : 'after';
    console.log('[DND][handleDrop] insertNodeAt action', pos);
    const inserted = insertNodeAt(editorNodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, pos);
    console.log('[DND][handleDrop] nodes after insertNodeAt:', inserted);
    console.log('[DND][handleDrop] Dispatching SET_NODES with nodes:', inserted);
    dispatch({ type: 'SET_NODES', nodes: inserted });
    return id;
  }

  console.log('[DND][handleDrop] fallback ADD_NODE as root');
  const nodeToAdd = { ...newNode, level: 0, parentId: undefined };
  console.log('[DND][handleDrop] Dispatching ADD_NODE with node:', nodeToAdd);
  dispatch({ type: 'ADD_NODE', node: nodeToAdd });
  return id;
} 