// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
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
}: SlotTreeNodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const nodeStyle: React.CSSProperties = {
    ...treeNodeStyle(theme, level, isSelected),
    ...(isHovered ? treeNodeHoverStyle(theme) : {}),
  };

  const labelStyleWithColor: React.CSSProperties = {
    ...labelStyle(theme),
    ...(labelColor ? { color: labelColor } : {}),
  };

  return (
    <div>
      <div
        style={nodeStyle}
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
        <div style={labelStyleWithColor}>{label}</div>
      </div>

      {isExpanded && children && (
        <div style={{ marginLeft: '0' }}>{children}</div>
      )}
    </div>
  );
}
