// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { treeNodeStyle, treeNodeHoverStyle, iconStyle, labelStyle, expandIconStyle, type Theme } from './styles';

interface SlotTreeNodeProps {
  icon: React.ReactNode;
  label: string;
  isExpanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onSelect: () => void;
  isSelected: boolean;
  children?: React.ReactNode;
  level: number;
  theme: Theme;
  labelColor?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isEditing?: boolean;
  editingComponent?: React.ReactNode;
}

/**
 * Generic reusable tree node component
 * Single Responsibility: Base rendering for all tree nodes
 */
export function SlotTreeNode({
  icon,
  label,
  isExpanded,
  hasChildren,
  onToggle,
  onSelect,
  isSelected,
  children,
  level,
  theme,
  labelColor,
  draggable = false,
  onDragStart,
  onEdit,
  onDelete,
  isEditing = false,
  editingComponent,
}: SlotTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const nodeStyle: React.CSSProperties = {
    ...treeNodeStyle(theme, level, isSelected),
    ...(isHovered ? treeNodeHoverStyle(theme) : {}),
    ...(draggable ? { cursor: 'grab' } : {}),
    position: 'relative',
  };

  const labelStyleWithColor: React.CSSProperties = {
    ...labelStyle(theme),
    ...(labelColor ? { color: labelColor } : {}),
  };

  return (
    <div>
      <div
        style={nodeStyle}
        draggable={draggable && !isEditing}
        onDragStart={onDragStart}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onSelect}
      >
        {hasChildren ? (
          <div
            style={{
              ...expandIconStyle,
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
        ) : (
          <div style={{ width: '12px', marginRight: '4px' }} />
        )}

        {icon && <div style={iconStyle}>{icon}</div>}
        {isEditing && editingComponent ? (
          <div style={{ flex: 1, minWidth: 0 }}>{editingComponent}</div>
        ) : (
          <div style={labelStyleWithColor}>{label}</div>
        )}

        {/* Toolbar on hover - only show if not editing and actions are available */}
        {!isEditing && (onEdit || onDelete) && isHovered && (
          <div
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: '4px',
              alignItems: 'center',
              backgroundColor: theme.background,
              padding: '2px 4px',
              borderRadius: '4px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fb923c',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Edit"
              >
                <Pencil size={14} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && children && (
        <div style={{ marginLeft: '0' }}>{children}</div>
      )}
    </div>
  );
}
