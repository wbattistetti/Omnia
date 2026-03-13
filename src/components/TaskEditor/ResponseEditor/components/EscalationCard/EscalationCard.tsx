import React, { useState } from 'react';
import { EscalationHeader } from './EscalationHeader';
import { EscalationTasksList } from './EscalationTasksList';
import { hasEscalationCard } from '@responseEditor/ddtUtils';

type EscalationCardProps = {
  escalation: any;
  escalationIdx: number;
  escalationName: string;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateEscalation: (updater: (esc: any) => any) => void;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  onDeleteEscalation?: () => void;
  autoEditTarget: { escIdx: number; taskIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; taskIdx: number } | null) => void;
  stepKey: string;
  hideHeader?: boolean; // Nasconde l'header nella vista ad albero
};

export function EscalationCard({
  escalation,
  escalationIdx,
  escalationName,
  color,
  translations,
  allowedActions,
  updateEscalation,
  updateSelectedNode,
  onDeleteEscalation,
  autoEditTarget,
  onAutoEditTargetChange,
  stepKey,
  hideHeader = false
}: EscalationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const showCard = hasEscalationCard(stepKey);

  // ✅ Calcola isEmpty PRIMA di useState
  const tasks = escalation?.tasks ?? [];
  const isEmpty = tasks.length === 0;

  // ✅ Inizializza sempre true (accordion parte sempre aperto)
  // Se hideHeader è true, forza sempre espanso (vista ad albero)
  const [isExpanded, setIsExpanded] = useState(true);

  // Se hideHeader è true, forza sempre espanso
  const effectiveIsExpanded = hideHeader ? true : isExpanded;

  // Per step senza escalation card (start, success), renderizza solo la lista task
  if (!showCard) {
    return (
      <EscalationTasksList
        escalation={escalation}
        escalationIdx={escalationIdx}
        color={color}
        translations={translations}
        allowedActions={allowedActions}
        updateEscalation={updateEscalation}
        updateSelectedNode={updateSelectedNode}
        autoEditTarget={autoEditTarget}
        onAutoEditTargetChange={onAutoEditTargetChange}
        stepKey={stepKey}
      />
    );
  }

  // Per step con escalation card (noMatch, noInput, confirmation, ecc.), renderizza la card completa
  return (
    <div
      data-escalation-index={escalationIdx} // ✅ NEW: Add data attribute for scroll targeting
      style={{
        borderWidth: isHovered ? '2px' : '1px',
        borderStyle: 'solid',
        borderColor: isHovered ? color : `${color}40`,
        borderRadius: '12px',
        padding: '1rem',
        backgroundColor: `${color}08`,
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        flex: '0 0 auto',
        minHeight: 'auto',
        overflow: 'visible',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!hideHeader && (
        <EscalationHeader
          name={escalationName}
          color={color}
          isHovered={isHovered}
          isExpanded={effectiveIsExpanded}
          onToggleExpand={() => setIsExpanded(!isExpanded)}
          onDelete={onDeleteEscalation}
        />
      )}
      {effectiveIsExpanded && (
        <div style={{
          flex: 'none',
          minHeight: isEmpty ? '120px' : 'auto',
          overflow: 'visible',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <EscalationTasksList
            escalation={escalation}
            escalationIdx={escalationIdx}
            color={color}
            translations={translations}
            allowedActions={allowedActions}
            updateEscalation={updateEscalation}
            updateSelectedNode={updateSelectedNode}
            autoEditTarget={autoEditTarget}
            onAutoEditTargetChange={onAutoEditTargetChange}
            stepKey={stepKey}
          />
        </div>
      )}
    </div>
  );
}
