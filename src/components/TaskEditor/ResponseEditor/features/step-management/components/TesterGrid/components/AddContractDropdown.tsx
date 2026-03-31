import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import {
  CONTRACT_METHOD_DISPLAY_ORDER,
  getContractMethodLabel,
  sortContractMethodsByDisplayOrder,
  type ContractMethod,
} from '@responseEditor/ContractSelector/ContractSelector';

interface AddContractDropdownProps {
  onSelect: (method: ContractMethod) => void;
  availableMethods?: ContractMethod[];
  label?: string;
}

/**
 * Dropdown for adding a contract method. Renders the menu in a portal with fixed
 * positioning so it is not clipped by TesterGrid overflow and receives pointer events.
 */
export default function AddContractDropdown({
  onSelect,
  availableMethods = [...CONTRACT_METHOD_DISPLAY_ORDER],
  label = 'Aggiungi contract',
}: AddContractDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; minWidth: number; maxHeight: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const margin = 8;
    const maxH = Math.max(120, Math.min(320, window.innerHeight - rect.bottom - margin));
    setMenuBox({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(rect.width, 200),
      maxHeight: maxH,
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuBox(null);
      return;
    }
    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const t = event.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    }
  }, [isOpen]);

  const handleSelect = (method: ContractMethod) => {
    onSelect(method);
    setIsOpen(false);
  };

  const menuContent =
    isOpen &&
    menuBox &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        role="menu"
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: menuBox.top,
          left: menuBox.left,
          minWidth: menuBox.minWidth,
          maxHeight: menuBox.maxHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 10050,
          scrollbarGutter: 'stable',
        }}
      >
        {sortContractMethodsByDisplayOrder(availableMethods).map((method) => (
          <button
            key={method}
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleSelect(method);
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#0b0f17',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {getContractMethodLabel(method)}
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((o) => !o);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#2563eb';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#3b82f6';
        }}
        title={label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Plus size={14} />
        <span>{label}</span>
      </button>

      {menuContent}
    </div>
  );
}
