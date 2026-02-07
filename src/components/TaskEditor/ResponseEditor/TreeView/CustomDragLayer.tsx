import React from 'react';
import { useDragLayer } from 'react-dnd';
import { TreeNodeProps } from '@responseEditor/types';
import { CustomDragLayerProps } from '@responseEditor/TreeView/TreeViewTypes';

const CustomDragLayer: React.FC<CustomDragLayerProps> = ({ nodes }) => {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
    currentOffset: monitor.getSourceClientOffset(),
  }));

  if (!isDragging || !item || !currentOffset) return null;

  const draggedNode = nodes.find(n => n.id === item.id);
  if (!draggedNode) return null;

  const previewText = (draggedNode.text || draggedNode.label || '').slice(0, 30) +
    (draggedNode.text && draggedNode.text.length > 30 ? '...' : '');

  return (
    <div style={{
      position: 'fixed',
      pointerEvents: 'none',
      left: currentOffset.x,
      top: currentOffset.y,
      zIndex: 1000,
      transform: 'translate(-50%, -50%)',
      background: '#fff',
      border: '2px solid #2563eb',
      borderRadius: 6,
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      padding: '8px 16px',
      minWidth: 120,
      maxWidth: 240,
      fontWeight: 500,
      fontSize: 15,
      color: '#222',
      opacity: 0.95
    }}>
      {previewText}
    </div>
  );
};

export default CustomDragLayer;