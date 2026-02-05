/**
 * CompactDropdown
 *
 * Custom dropdown component with free overlay positioning.
 * Used in compact wizard mode for template selection.
 *
 * Features:
 * - Overlay free (portal or fixed position)
 * - No overflow clipping
 * - Scrollable list
 * - Highlight selected item
 * - Close on blur
 * - Future support for payload, tooltip, rich layouts
 */

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import IconRenderer from './components/IconRenderer';

interface Template {
  _id?: string;
  id?: string;
  name?: string;
  label?: string;
  icon?: string;
  [key: string]: any; // Support future payload
}

interface CompactDropdownProps {
  placeholder: string;
  templates: Template[];
  selectedTemplateId?: string;
  loading?: boolean;
  onSelect: (templateId: string, template: Template) => void;
  disabled?: boolean;
}

const CompactDropdown: React.FC<CompactDropdownProps> = ({
  placeholder,
  templates,
  selectedTemplateId,
  loading = false,
  onSelect,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close on blur (click outside)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (templateId: string) => {
    const template = templates.find(t => (t._id || t.id || t.name) === templateId);
    if (template) {
      onSelect(templateId, template);
      setIsOpen(false);
    }
  };

  const selectedTemplate = selectedTemplateId
    ? templates.find(t => (t._id || t.id || t.name) === selectedTemplateId)
    : null;

  const dropdownContent = isOpen && dropdownPosition && (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        maxHeight: '300px',
        overflowY: 'auto',
        borderRadius: 8,
        border: '1px solid #4b5563',
        background: '#111827',
        zIndex: 10001, // Above modal (z-index: 10000)
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      }}
    >
      {loading ? (
        <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 14 }}>
          Caricamento...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 14 }}>
          Nessun template disponibile
        </div>
      ) : (
        templates.map((template) => {
          const id = template._id || template.id || template.name;
          const label = template.label || template.name || 'Unnamed Template';
          const icon = template.icon || 'FileText';
          const isSelected = selectedTemplateId === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelect(id)}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: isSelected ? '#1f2937' : 'transparent',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textAlign: 'left',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = '#1f2937';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              title={template.description || label} // Future: tooltip support
            >
              <IconRenderer name={icon} size={16} />
              <span style={{ flex: 1 }}>{label}</span>
              {isSelected && (
                <span style={{ color: '#22c55e', fontSize: 12 }}>✓</span>
              )}
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid #4b5563',
          background: '#111827',
          color: '#fff',
          outline: 'none',
          cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
          opacity: (disabled || loading) ? 0.6 : 1,
          fontSize: 14,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {selectedTemplate ? (
            <>
              <IconRenderer name={selectedTemplate.icon || 'FileText'} size={16} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedTemplate.label || selectedTemplate.name || 'Unnamed Template'}
              </span>
            </>
          ) : (
            <span style={{ color: '#9ca3af' }}>{placeholder}</span>
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Render dropdown in portal for free overlay */}
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
};

export default CompactDropdown;
