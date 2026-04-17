import React from 'react';
import { stepMeta } from '@responseEditor/ddtUtils';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

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
  /** Show + at bottom of colored strip (tree view: append escalation for this step). */
  showAddEscalationButton?: boolean;
  onAddEscalation?: () => void;
  /** Native tooltip on the + button (e.g. Italian UX copy). */
  addEscalationTooltip?: string;
  /** Tree view: remove this escalation lane (only when more than one lane exists). */
  showDeleteEscalationButton?: boolean;
  onDeleteEscalation?: () => void;
  deleteEscalationTooltip?: string;
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
  children,
  showAddEscalationButton = false,
  onAddEscalation,
  addEscalationTooltip,
  showDeleteEscalationButton = false,
  onDeleteEscalation,
  deleteEscalationTooltip,
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
      {/* Fascia verticale: icona al centro, + in basso (aggiungi escalation) */}
      <div
        onClick={onClick}
        title={showChevron ? "Click per collassare/espandere. Ctrl+Click per nascondere/mostrare altre escalation." : undefined}
        style={{
          width: '50px',
          alignSelf: 'stretch',
          background: `linear-gradient(to right, ${bgColor}, ${isHovered ? `${color}50` : `${color}40`})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          position: 'relative',
          padding: '4px 0',
          minHeight: '40px',
        }}
      >
        {showDeleteEscalationButton && onDeleteEscalation && (
          <button
            type="button"
            title={deleteEscalationTooltip}
            aria-label={deleteEscalationTooltip}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteEscalation();
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              marginTop: 2,
              marginBottom: 2,
              border: 'none',
              borderRadius: 6,
              background: `${color}25`,
              color: '#ef4444',
              cursor: 'pointer',
              transition: 'background 0.15s, opacity 0.15s',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              position: 'relative',
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ef444420';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${color}25`;
            }}
          >
            <Trash2 size={15} strokeWidth={2.25} />
          </button>
        )}

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
              transition: 'opacity 0.2s',
              /* Sopra al cestino nello stack: senza questo i click finiscono sul chevron e il cestino non riceve l’evento */
              pointerEvents: 'none',
            }}
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </div>
        )}

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
            width: '100%',
            color: `${color}90`,
          }}
        >
          {icon}
        </div>

        {showAddEscalationButton && onAddEscalation && (
          <button
            type="button"
            title={addEscalationTooltip}
            aria-label={addEscalationTooltip}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onAddEscalation();
            }}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              marginBottom: 4,
              border: 'none',
              borderRadius: 6,
              background: `${color}30`,
              color: '#fbbf24',
              cursor: 'pointer',
              transition: 'background 0.15s, transform 0.1s, opacity 0.15s',
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${color}55`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${color}30`;
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Contenuto escalation - EscalationCard senza bordo esterno (gestito dal container) */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'stretch',
        }}
      >
        {children}
      </div>
    </div>
  );
}
