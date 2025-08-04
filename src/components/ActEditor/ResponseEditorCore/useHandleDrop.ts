import { TreeNodeProps } from '../ResponseEditor/types';

interface DropParams {
  editorNodes: TreeNodeProps[];
  targetId: string | null;
  position: 'before' | 'after' | 'child';
  item: any;
  selectedStep: string;
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
  if (!item || !item.action) return;

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
    parameters: item.parameters || [],
    stepType: selectedStep,
    level: 0,
    parentId: undefined
  };

  if (!targetId) {
    dispatch({ type: 'ADD_NODE', node: newNode });
    return;
  }

  const targetNode = editorNodes.find(n => n.id === targetId);
  if (!targetNode) {
    dispatch({ type: 'ADD_NODE', node: newNode });
    return;
  }

  if (targetNode.type === 'escalation' && position === 'child') {
    dispatch({ 
      type: 'ADD_NODE', 
      node: { 
        ...newNode, 
        level: (targetNode.level || 0) + 1, 
        parentId: targetNode.id 
      } 
    });
    return;
  }

  // Inserimento prima/dopo il target
  const targetIndex = editorNodes.findIndex(n => n.id === targetId);
  if (targetIndex === -1) {
    dispatch({ type: 'ADD_NODE', node: newNode });
    return;
  }

  const newNodes = [...editorNodes];
  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  
  newNode.level = targetNode.level;
  newNode.parentId = targetNode.parentId;
  
  newNodes.splice(insertIndex, 0, newNode);
  
  dispatch({ type: 'SET_NODES', nodes: newNodes });
} 