import React from 'react';
import { TreeNode } from './TreeNode';

interface TreeViewProps {
  nodes: any[];
  onRemoveNode: (id: string) => void;
}

export const TreeView: React.FC<TreeViewProps> = ({ nodes, onRemoveNode }) => {
  return (
    <div className="tree-view">
      {nodes.length === 0 ? (
        <div className="text-gray-500 italic p-4">
          Nessun nodo disponibile
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              onRemoveNode={onRemoveNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}; 