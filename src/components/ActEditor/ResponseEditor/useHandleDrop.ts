import { TreeNodeProps } from './types';
import { createTask } from './taskFactories';
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

  if (!item) {
    console.error('[DND][handleDrop] No item provided');
    return null;
  }

  if (!item.task) {
    console.error('[DND][handleDrop] Item has no task property:', item);
    return null;
  }

  const task = item.task;
  const id = Math.random().toString(36).substr(2, 9);

  const newNode: TreeNodeProps = createTask({
    id,
    text: typeof task.label === 'object' ? task.label.it || task.label.en || task.id : task.label,
    type: 'task',
    icon: item.icon,
    color: item.color,
    label: typeof task.label === 'object' ? task.label.it || task.label.en || task.id : task.label,
    primaryValue: item.primaryValue,
    parameters: item.parameters ? item.parameters.map(createParameter) : undefined,
  });

  if (targetId === null) {
    const nodeToAdd = { ...newNode, level: 0, parentId: undefined };
    dispatch({ type: 'ADD_NODE', node: nodeToAdd });
    return id;
  }

  const targetNode = editorNodes.find(n => n.id === targetId);

  if (!targetNode) {
    const nodeToAdd = { ...newNode, level: 0, parentId: undefined };
    dispatch({ type: 'ADD_NODE', node: nodeToAdd });
    return id;
  }

  if (targetNode.type === 'escalation' && position === 'child') {
    const nodeToAdd = { ...newNode, level: (targetNode.level || 0) + 1, parentId: targetNode.id };
    dispatch({ type: 'ADD_NODE', node: nodeToAdd });
    return id;
  }

  if (targetNode.type === 'escalation' && (position === 'before' || position === 'after')) {
    const inserted = insertNodeAt(editorNodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, position);
    dispatch({ type: 'SET_NODES', nodes: inserted });
    return id;
  }

  if (targetNode.type === 'task') {
    const pos: 'before' | 'after' = position === 'before' ? 'before' : 'after';
    const inserted = insertNodeAt(editorNodes, { ...newNode, level: targetNode.level, parentId: targetNode.parentId }, targetId, pos);
    dispatch({ type: 'SET_NODES', nodes: inserted });
    return id;
  }

  const nodeToAdd = { ...newNode, level: 0, parentId: undefined };
  dispatch({ type: 'ADD_NODE', node: nodeToAdd });
  return id;
}