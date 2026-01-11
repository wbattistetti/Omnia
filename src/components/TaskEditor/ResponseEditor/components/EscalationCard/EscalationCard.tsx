import React, { useState } from 'react';
import { EscalationHeader } from './EscalationHeader';
import { EscalationTasksList } from './EscalationTasksList';

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
  autoEditTarget: { escIdx: number; actIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; actIdx: number } | null) => void;
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

  return (
    <div
      style={{
        border: `1px solid ${color}40`,
        borderRadius: '12px',
        padding: '1rem',
        backgroundColor: `${color}08`,
        transition: 'all 0.2s',
        borderWidth: isHovered ? `2px` : '1px',
        borderColor: isHovered ? color : `${color}40`,
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
      )}
    </div>
  );
}
