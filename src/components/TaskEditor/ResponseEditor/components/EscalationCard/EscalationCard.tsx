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
  stepKey: string;
  hideHeader?: boolean;
  isHovered?: boolean;
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
  stepKey,
  hideHeader = false,
  isHovered = false,
}: EscalationCardProps) {
  const showCard = hasEscalationCard(stepKey);

  const tasks = escalation?.tasks ?? [];
  const isEmpty = tasks.length === 0;

  const [isExpanded, setIsExpanded] = useState(true);

  const effectiveIsExpanded = hideHeader ? true : isExpanded;

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
        stepKey={stepKey}
      />
    );
  }

  return (
    <div
      data-escalation-index={escalationIdx}
      style={{
        padding: '0.5rem',
        backgroundColor: 'transparent',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        flex: '0 0 auto',
        minHeight: 'auto',
        overflow: 'visible',
      }}
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
        <div
          style={{
            flex: 'none',
            minHeight: isEmpty ? '120px' : 'auto',
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <EscalationTasksList
            escalation={escalation}
            escalationIdx={escalationIdx}
            color={color}
            translations={translations}
            allowedActions={allowedActions}
            updateEscalation={updateEscalation}
            updateSelectedNode={updateSelectedNode}
            stepKey={stepKey}
          />
        </div>
      )}
    </div>
  );
}
