// Executive summary: Renders the tree structure of response nodes and manages their state and drag & drop logic.
import React from 'react';
import TreeNode from './TreeNode';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';
import { useDroppable } from '@dnd-kit/core';

interface TreeViewProps {
  initialNodes?: TreeNodeProps[];
}

const defaultNodes: TreeNodeProps[] = [
  { id: '1', text: "What is the patient's date of birth?", type: 'root', onDrop: () => {} },
  { id: '2', text: "I didn't understand. Could you provide the patient's date of birth?", type: 'nomatch', level: 1, parentId: '1', onDrop: () => {} },
  { id: '3', text: "Please provide the patient's date of birth.", type: 'noinput', level: 1, parentId: '1', onDrop: () => {} }
];

const TreeView: React.FC<TreeViewProps> = ({ initialNodes }) => {
  const { nodes, handleDrop, addNode } = useTreeNodes(initialNodes || defaultNodes);
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' });

  return (
    <div
      ref={setNodeRef}
      className="h-full flex flex-col"
      style={{
        position: 'relative',
        minHeight: 200,
        border: '2px solid transparent',
        transition: 'border 0.2s',
        background: isOver ? 'rgba(37,99,235,0.08)' : undefined
      }}
    >
      {/* Lista dei nodi */}
      <div>
        {nodes.map(node => (
          <TreeNode
            key={node.id}
            {...node}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
};

export default TreeView; 