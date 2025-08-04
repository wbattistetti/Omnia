import React from 'react';
import { Trash2 } from 'lucide-react';

interface TreeNodeProps {
  node: any;
  onRemoveNode: (id: string) => void;
}

export const TreeNode: React.FC<TreeNodeProps> = ({ node, onRemoveNode }) => {
  const handleRemove = () => {
    onRemoveNode(node.id);
  };

  return (
    <div className="tree-node border border-gray-200 rounded p-3 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium text-gray-900">
            {node.text || node.id}
          </div>
          <div className="text-sm text-gray-500">
            Tipo: {node.type} | Livello: {node.level}
          </div>
        </div>
        
        {/* Cestino funzionante - senza wrapper che bloccano eventi */}
        <button
          type="button"
          aria-label="Elimina nodo"
          onClick={handleRemove}
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
          title="Elimina nodo"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}; 