// Executive summary: Represents a single node in the response tree, including drag & drop and visual state.
import React, { useState, useRef } from 'react';
import { ChevronRight, ChevronDown, MessageCircle } from 'lucide-react';
import getIconComponent from './icons';
import { TreeNodeProps } from './types';
import styles from './TreeNode.module.css';
import { useDroppable } from '@dnd-kit/core';

const TreeNode: React.FC<TreeNodeProps> = ({ 
  text, 
  type,
  level = 0, 
  expanded = true,
  id,
  icon,
  color,
  parentId,
  onDrop
}) => {
  const INDENT_WIDTH = 24;
  const ref = useRef<HTMLDivElement>(null);
  const { setNodeRef, isOver, active } = useDroppable({ id });
  const [dropTarget, setDropTarget] = useState<'before' | 'after' | 'child' | null>(null);

  // Calcola posizione del mouse per feedback
  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < rect.height * 0.25) {
      setDropTarget('before');
    } else if (y > rect.height * 0.75) {
      setDropTarget('after');
    } else {
      setDropTarget('child');
    }
  };
  const handlePointerLeave = () => setDropTarget(null);

  // Drop effettivo
  const handleDrop = () => {
    if (dropTarget && active && active.data && active.data.current) {
      onDrop(id, dropTarget, active.data.current.action);
    }
    setDropTarget(null);
  };

  const getBgClass = () => {
    switch (type) {
      case 'nomatch':
        return styles.bgNoMatch;
      case 'noinput':
        return styles.bgNoInput;
      case 'action':
        return styles.bgAction;
      default:
        return styles.bgRoot;
    }
  };

  return (
    <div 
      ref={setNodeRef}
      style={{ position: 'relative' }}
      onPointerMove={isOver ? handlePointerMove : undefined}
      onPointerLeave={isOver ? handlePointerLeave : undefined}
      onPointerUp={isOver ? handleDrop : undefined}
    >
      {/* Feedback visivo dnd-kit */}
      {isOver && dropTarget === 'before' && (
        <div style={{ position: 'absolute', top: -2, left: 0, right: 0, height: 4, background: '#2563eb', borderRadius: 2, zIndex: 10 }} />
      )}
      <div
        className={`${styles.node} ${getBgClass()}`}
        style={{ marginLeft: `${level * INDENT_WIDTH}px` }}
      >
        {expanded ? <ChevronDown size={16} style={{ marginRight: 8 }} /> : <ChevronRight size={16} style={{ marginRight: 8 }} />}
        <div style={{ marginRight: 8 }} className={color || ''}>
          {type === 'action' && icon ? getIconComponent(icon) : <MessageCircle size={16} />}
        </div>
        <span style={{ fontSize: '0.875rem' }}>{text}</span>
        {isOver && dropTarget === 'child' && (
          <div style={{ position: 'absolute', inset: 0, border: '2px solid #2563eb', borderRadius: 6, pointerEvents: 'none', zIndex: 10 }} />
        )}
      </div>
      {isOver && dropTarget === 'after' && (
        <div style={{ position: 'absolute', bottom: -2, left: 0, right: 0, height: 4, background: '#2563eb', borderRadius: 2, zIndex: 10 }} />
      )}
    </div>
  );
};

export default TreeNode; 