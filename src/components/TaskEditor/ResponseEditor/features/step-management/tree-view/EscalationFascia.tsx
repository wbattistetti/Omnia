import React from 'react';
import { stepMeta } from '@responseEditor/ddtUtils';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface EscalationFasciaProps {
  stepKey: string;
  escalationIdx: number;
  isHovered: boolean;
  isCollapsed: boolean;
  showChevron: boolean; // Solo prima escalation ha chevron
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

/**
 * Componente atomico: fascia verticale colorata per escalation
 * Wrappa il contenuto dell'escalation (EscalationCard) con bordo esterno arrotondato
 */
export function EscalationFascia({
  stepKey,
  escalationIdx,
  isHovered,
  isCollapsed,
  showChevron,
  onMouseEnter,
  onMouseLeave,
  onClick,
  children
}: EscalationFasciaProps) {
  const meta = stepMeta[stepKey] || {
    icon: null,
    color: '#fb923c',
    border: '#fb923c',
    bg: 'rgba(251,146,60,0.08)'
  };

  const icon = meta.icon;
  const color = meta.border || meta.color;

  // Colori smorzati con trasparenza
  const bgColor = isHovered ? `${color}20` : `${color}10`; // Trasparenza ridotta
  const borderColor = `${color}40`; // Bordo smorzato

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        marginLeft: `${(escalationIdx + 1) * 50}px`, // Indentazione progressiva
        marginBottom: '0.5rem'
      }}
    >
      {/* Fascia verticale */}
      <div
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        title={showChevron ? "Click per collassare/espandere. Ctrl+Click per nascondere/mostrare altre escalation." : undefined}
        style={{
          width: '50px',
          alignSelf: 'stretch',
          backgroundColor: bgColor,
          borderLeft: `3px solid ${color}60`, // Bordo smorzato
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          position: 'relative',
          padding: '8px 0',
          minHeight: '50px'
        }}
      >
        {/* Chevron solo sulla prima escalation */}
        {showChevron && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              fontSize: '12px',
              color: `${color}80`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </div>
        )}

        {/* Icona centrata */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: `${color}90` // Icona leggermente smorzata
          }}
        >
          {icon}
        </div>
      </div>

      {/* Contenuto escalation - EscalationCard ha già il suo bordo e area di drop */}
      <div
        style={{
          flex: 1
        }}
      >
        {children}
      </div>
    </div>
  );
}
