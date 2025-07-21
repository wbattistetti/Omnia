// Executive summary: Represents a single draggable action item with icon and label.
import React from 'react';
import { ActionItemProps } from '../types';
import styles from './ActionItem.module.css';

const MIN_THUMBNAIL_WIDTH = 100;

const ActionItem: React.FC<ActionItemProps> = ({ icon, label, color, description }) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'action', label, color, icon: label }));
    e.dataTransfer.effectAllowed = 'copy';

    // Create a transparent drag image
    const dragImage = document.createElement('div');
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-9999px';
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  return (
    <div 
      className={styles.item}
      style={{ minWidth: MIN_THUMBNAIL_WIDTH }}
      draggable
      onDragStart={handleDragStart}
      title={description || ''}
    >
      <div className={`${color} ${styles.icon}`}>
        {icon}
      </div>
      <span className={styles.label}>{label}</span>
    </div>
  );
};

export default ActionItem; 