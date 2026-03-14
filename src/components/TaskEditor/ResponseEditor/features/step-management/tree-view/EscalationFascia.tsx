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

  // Colori con maggiore saturazione
  const bgColor = isHovered ? `${color}35` : `${color}25`; // ✅ Saturazione aumentata
  const borderColor = `${color}40`; // Bordo smorzato

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        marginLeft: `${(escalationIdx + 1) * 50}px`, // Indentazione progressiva
        marginBottom: '0.25rem',
        borderWidth: isHovered ? '2px' : '1px',
        borderStyle: 'solid',
        borderColor: isHovered ? color : `${color}40`,
        borderRadius: '12px',
        overflow: 'hidden', // ✅ Importante: fa rispettare il borderRadius ai figli
        backgroundColor: `${color}08` // Background unificato per tutta la card
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
          // ✅ Gradiente: più saturo a destra (come intestazione colorata)
          background: `linear-gradient(to right, ${bgColor}, ${isHovered ? `${color}50` : `${color}40`})`,
          // ✅ Rimosso borderLeft - il bordo è ora sul container esterno
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center', // ✅ Center/center: icona centrata
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          position: 'relative',
          padding: '4px 0',
          minHeight: '40px'
        }}
      >
        {/* Chevron solo sulla prima escalation e solo su hover */}
        {showChevron && isHovered && (
          <div
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              fontSize: '12px',
              color: `${color}80`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.2s'
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

      {/* Contenuto escalation - EscalationCard senza bordo esterno (gestito dal container) */}
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
