// Executive summary: Renders the tree structure of response nodes and manages their state and drag & drop logic.
import React from 'react';
import TreeNode from './TreeNode';
import { TreeNodeProps } from './types';
import { useTreeNodes } from './useTreeNodes';

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

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      console.log('[TreeView] handleCanvasDrop chiamato con data:', data);
      addNode(data);
    } catch (error) {
      console.error('[TreeView] Error handling canvas drop:', error);
    }
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    console.log('[TreeView] handleCanvasDragOver');
  };

  return (
    <div className="h-full flex flex-col" style={{ position: 'relative' }}>
      {/* Area di drop sopra tutto */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          minHeight: 100,
          background: 'rgba(37,99,235,0.08)',
          border: '4px solid #2563eb',
          pointerEvents: 'all',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
      >
        <span style={{ color: '#1e3a8a', fontWeight: 600, fontSize: 18 }}>Drop here</span>
      </div>
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