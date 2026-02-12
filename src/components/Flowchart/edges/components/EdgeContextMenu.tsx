import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LinkStyle } from '@components/Flowchart/types/flowTypes';

interface EdgeContextMenuProps {
  x: number;
  y: number;
  currentLinkStyle: LinkStyle;
  onSelectStyle: (style: LinkStyle) => void;
  onClose: () => void;
}

/**
 * Context menu for edge link style selection
 *
 * Replaces the inline DOM manipulation logic from CustomEdge.tsx
 * with a clean React component using createPortal.
 */
export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  currentLinkStyle,
  onSelectStyle,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use setTimeout to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, { once: true });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const menuItems: Array<{ label: string; style: LinkStyle }> = [
    { label: 'AutoOrtho', style: LinkStyle.AutoOrtho },
    { label: 'Bezier', style: LinkStyle.Bezier },
    { label: 'Ortogonale (smooth)', style: LinkStyle.SmoothStep },
    { label: 'Ortogonale (step)', style: LinkStyle.Step },
    { label: 'HVH', style: LinkStyle.HVH },
    { label: 'VHV', style: LinkStyle.VHV },
  ];

  const handleItemClick = (style: LinkStyle) => {
    onSelectStyle(style);
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        background: '#111827',
        color: '#E5E7EB',
        border: '1px solid #374151',
        borderRadius: '6px',
        padding: '6px',
        zIndex: 99999,
        fontSize: '12px',
        minWidth: '150px',
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menuItems.map((item) => (
        <button
          key={item.style}
          onClick={() => handleItemClick(item.style)}
          style={{
            display: 'block',
            width: '100%',
            background: currentLinkStyle === item.style ? '#1F2937' : 'transparent',
            color: 'inherit',
            border: 'none',
            textAlign: 'left',
            padding: '4px 8px',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1F2937';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              currentLinkStyle === item.style ? '#1F2937' : 'transparent';
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
};
