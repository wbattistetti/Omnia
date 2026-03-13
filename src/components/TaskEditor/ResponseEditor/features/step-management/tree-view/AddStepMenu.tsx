import React, { useEffect, useRef } from 'react';
import { stepMeta } from '@responseEditor/ddtUtils';
import { ToolbarPosition } from './hooks/useStepFasciaHover';

interface AddStepMenuProps {
  availableSteps: string[];
  onSelectStep: (stepKey: string) => void;
  position: ToolbarPosition;
  onClose: () => void;
}

/**
 * Menu dropdown per aggiungere step
 */
export function AddStepMenu({
  availableSteps,
  onSelectStep,
  position,
  onClose
}: AddStepMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (availableSteps.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 10001,
        minWidth: '200px',
        maxHeight: '300px',
        overflowY: 'auto'
      }}
    >
      {availableSteps.map(stepKey => {
        const meta = stepMeta[stepKey];
        if (!meta) return null;

        return (
          <button
            key={stepKey}
            onClick={() => onSelectStep(stepKey)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '14px',
              color: '#374151'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ color: meta.color }}>{meta.icon}</span>
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
