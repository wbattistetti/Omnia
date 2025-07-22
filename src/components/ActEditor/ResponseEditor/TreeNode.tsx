// Executive summary: Represents a single node in the response tree, including drag & drop and visual state.
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, MessageCircle } from 'lucide-react';
import getIconComponent from './icons';
import { TreeNodeProps } from './types';
import styles from './TreeNode.module.css';

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
  const [dropTarget, setDropTarget] = useState<'before' | 'after' | 'child' | 'parent-sibling' | null>(null);
  const INDENT_WIDTH = 24;

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Accetta sempre il drop se c'è un oggetto action
    let isAction = false;
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      isAction = data && data.type === 'action';
    } catch {
      // fallback: accetta comunque
      isAction = true;
    }
    if (!isAction) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;
    const indentationSpace = level * INDENT_WIDTH;
    
    if (y < rect.height * 0.25) {
      setDropTarget('before');
    } else if (y > rect.height * 0.75) {
      if (level > 0 && x < indentationSpace) {
        setDropTarget('parent-sibling');
      } else {
        setDropTarget('after');
      }
    } else {
      setDropTarget('child');
    }
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropTarget) {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      onDrop(id, dropTarget, data);
    }
    setDropTarget(null);
  };

  return (
    <div 
      style={{ position: 'relative' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dropTarget === 'before' && (
        <div className={styles.dropBefore} />
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
        {dropTarget === 'child' && (
          <div className={styles.dropChild} />
        )}
      </div>
      {dropTarget === 'after' && (
        <div className={styles.dropAfter} />
      )}
      {dropTarget === 'parent-sibling' && (
        <div 
          className={styles.dropParentSibling}
          style={{ width: `${level * INDENT_WIDTH}px` }}
        />
      )}
    </div>
  );
};

export default TreeNode; 