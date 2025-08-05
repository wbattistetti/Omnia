// Executive summary: Refactored TreeView component that uses extracted components and hooks for better separation of concerns
import React, { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import TreeRenderer from './TreeRenderer';
import CustomDragLayer from './CustomDragLayer';
import DropPreview from './DropPreview';
import { useTreeDragDrop } from './useTreeDragDrop';
import { TreeViewProps } from './TreeViewTypes';

const TreeView: React.FC<TreeViewProps> = ({ 
  nodes, 
  onDrop, 
  onRemove, 
  onAddEscalation, 
  onToggleInclude, 
  stepKey, 
  foreColor, 
  bgColor 
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Use the extracted drag & drop hook
  const {
    isOver,
    dropPreviewIdx,
    dropPreviewPosition,
    setDropPreviewIdx,
    setDropPreviewPosition
  } = useTreeDragDrop({
    nodes,
    onDrop,
    containerRef,
    setSelectedNodeId
  });

  return (
    <div
      ref={node => { containerRef.current = node; }}
      className="h-full flex flex-col"
      style={{
        position: 'relative',
        minHeight: 200,
        border: isOver ? '2px solid #60a5fa' : '2px solid transparent',
        transition: 'border 0.2s',
        background: isOver ? 'rgba(96,165,250,0.08)' : undefined
      }}
    >
      <CustomDragLayer nodes={nodes} />
      
      <DropPreview 
        dropPreviewIdx={dropPreviewIdx}
        dropPreviewPosition={dropPreviewPosition}
        nodes={nodes}
      />
      
      <TreeRenderer
        nodes={nodes}
        parentId={undefined}
        level={0}
        selectedNodeId={selectedNodeId}
        onDrop={onDrop}
        onRemove={onRemove}
        setSelectedNodeId={setSelectedNodeId}
        stepKey={stepKey}
        extraProps={{ onToggleInclude, foreColor, bgColor }}
      />

      {/* Bottone aggiungi escalation in fondo se ci sono escalation visibili */}
      {onAddEscalation && nodes.some(n => n.type === 'escalation') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            onClick={onAddEscalation}
            style={{
              color: foreColor || '#ef4444',
              border: `1.5px solid ${foreColor || '#ef4444'}`,
              background: bgColor || 'rgba(239,68,68,0.08)',
              borderRadius: 999,
              padding: '5px 18px',
              fontWeight: 700,
              fontSize: 15,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              marginTop: 8
            }}
          >
            <Plus size={18} style={{ marginRight: 6 }} />
            {stepKey === 'confirmation' ? 'Aggiungi conferma' : 'Aggiungi recovery'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TreeView; 