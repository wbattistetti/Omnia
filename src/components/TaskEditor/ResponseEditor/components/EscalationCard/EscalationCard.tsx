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
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
  onDeleteEscalation?: () => void;
  autoEditTarget: { escIdx: number; taskIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; taskIdx: number } | null) => void;
  stepKey: string;
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
  stepKey
}: EscalationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const showCard = hasEscalationCard(stepKey);

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
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <EscalationHeader
        name={escalationName}
        color={color}
        isHovered={isHovered}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onDelete={onDeleteEscalation}
      />
      {isExpanded && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
