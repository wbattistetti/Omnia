// Executive summary: Renders the tree structure of response nodes and manages their state and drag & drop logic.
import React from 'react';
import TreeNode from './TreeNode';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';

const initialNodes: TreeNodeProps[] = [
  { id: '1', text: "What is the patient's date of birth?", type: 'root', onDrop: () => {} },
  { id: '2', text: "I didn't understand. Could you provide the patient's date of birth?", type: 'nomatch', level: 1, parentId: '1', onDrop: () => {} },
  { id: '3', text: "Please provide the patient's date of birth.", type: 'noinput', level: 1, parentId: '1', onDrop: () => {} }
];

const TreeView: React.FC = () => {
  const { nodes, handleDrop, addNode } = useTreeNodes(initialNodes);

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      addNode(data);
    } catch (error) {
      console.error('Error handling canvas drop:', error);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="h-full flex flex-col">
      <div>
        {nodes.map(node => (
          <TreeNode 
            key={node.id}
            {...node}
            onDrop={handleDrop}
          />
        ))}
      </div>
      <div 
        className="flex-1 min-h-[200px]"
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
      />
    </div>
  );
};

export default TreeView; 