import React from 'react';
import { stepMeta } from '@responseEditor/ddtUtils';

interface StepFasciaProps {
  stepKey: string;
  isRoot: boolean;
  isHovered: boolean;
  isCollapsed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onRef: (ref: HTMLDivElement | null) => void;
}

/**
 * Componente atomico: fascia verticale colorata con icona centrata
 * Nessuna logica di business, solo presentazione
 */
export function StepFascia({
  stepKey,
  isRoot,
  isHovered,
  isCollapsed,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onRef
}: StepFasciaProps) {
  const meta = stepMeta[stepKey] || {
    icon: null,
    color: '#fb923c',
    border: '#fb923c',
    bg: 'rgba(251,146,60,0.08)'
  };

  const icon = meta.icon;
  const color = meta.border || meta.color;

  return (
    <div
      ref={onRef}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        width: '50px',
        alignSelf: 'stretch', // Si estende per tutta l'altezza del container
        backgroundColor: isHovered ? `${color}15` : meta.bg,
        borderLeft: `3px solid ${color}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        position: 'relative',
        padding: '8px 0',
        minHeight: isCollapsed ? '50px' : 'auto' // Altezza minima solo se collassato
      }}
    >
      {/* Icona centrata */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color
        }}
      >
        {icon}
      </div>

      {/* Indicatore collapse */}
      <div
        style={{
          position: 'absolute',
          top: '4px',
          right: '4px',
          fontSize: '10px',
          color: color,
          opacity: 0.6
        }}
      >
        {isCollapsed ? '▶' : '▼'}
      </div>
    </div>
  );
}
