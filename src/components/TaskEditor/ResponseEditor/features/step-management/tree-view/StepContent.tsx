import React, { useState } from 'react';
import { EscalationCard } from '@responseEditor/components/EscalationCard/EscalationCard';
import { useEscalationUpdate } from '@responseEditor/hooks/useEscalationUpdate';
import { getEscalationName } from '@responseEditor/utils/escalationHelpers';
import { stepMeta } from '@responseEditor/ddtUtils';
import { EscalationFascia } from './EscalationFascia';
import { useEscalationCollapse } from './hooks/useEscalationCollapse';

interface EscalationCardWrapperProps {
  escalation: any;
  escalationIdx: number;
  stepKey: string;
  stepLabel: string;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  onDeleteEscalation: (escalationIdx: number) => void;
  isCollapsed: boolean;
  showChevron: boolean;
  onToggleCollapse: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  isHovered: boolean;
}

function EscalationCardWrapper({
  escalation,
  escalationIdx,
  stepKey,
  stepLabel,
  color,
  translations,
  allowedActions,
  updateSelectedNode,
  onDeleteEscalation,
  isCollapsed,
  showChevron,
  onToggleCollapse,
  onMouseEnter,
  onMouseLeave,
  isHovered,
}: EscalationCardWrapperProps) {
  const { updateEscalation } = useEscalationUpdate(updateSelectedNode, stepKey, escalationIdx);
  const escalationName = getEscalationName(stepLabel, escalationIdx);

  const tasks = escalation?.tasks ?? [];
  const displayTasks = isCollapsed ? tasks.slice(0, 1) : tasks;
  const modifiedEscalation = { ...escalation, tasks: displayTasks };

  return (
    <EscalationFascia
      stepKey={stepKey}
      escalationIdx={escalationIdx}
      isHovered={isHovered}
      isCollapsed={isCollapsed}
      showChevron={showChevron}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onToggleCollapse}
    >
      <EscalationCard
        escalation={modifiedEscalation}
        escalationIdx={escalationIdx}
        escalationName={escalationName}
        color={color}
        translations={translations}
        allowedActions={allowedActions}
        updateEscalation={updateEscalation}
        updateSelectedNode={updateSelectedNode}
        onDeleteEscalation={() => onDeleteEscalation(escalationIdx)}
        stepKey={stepKey}
        hideHeader={true}
        isHovered={isHovered}
      />
    </EscalationFascia>
  );
}

interface StepContentProps {
  stepKey: string;
  escalations: any[];
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  onDeleteEscalation: (escalationIdx: number) => void;
}

/**
 * Contenuto step: renderizza escalation
 * Riutilizza EscalationCard esistente
 */
export function StepContent({
  stepKey,
  escalations,
  color,
  translations,
  allowedActions,
  updateSelectedNode,
  onDeleteEscalation,
}: StepContentProps) {
  const stepLabel = stepMeta[stepKey]?.label || 'Escalation';
  const { hideOtherEscalations, toggleCollapse, isCollapsed } = useEscalationCollapse();
  const [hoveredEscalation, setHoveredEscalation] = useState<number | null>(null);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
      }}
    >
      {escalations.map((escalation, idx) => {
        if (hideOtherEscalations && idx !== 0) {
          return null;
        }

        const collapsed = isCollapsed(idx);
        const hovered = hoveredEscalation === idx;

        return (
          <EscalationCardWrapper
            key={idx}
            escalation={escalation}
            escalationIdx={idx}
            stepKey={stepKey}
            stepLabel={stepLabel}
            color={color}
            translations={translations}
            allowedActions={allowedActions}
            updateSelectedNode={updateSelectedNode}
            onDeleteEscalation={onDeleteEscalation}
            isCollapsed={collapsed}
            showChevron={idx === 0}
            onToggleCollapse={(e) => toggleCollapse(idx, e.ctrlKey)}
            onMouseEnter={() => setHoveredEscalation(idx)}
            onMouseLeave={() => setHoveredEscalation(null)}
            isHovered={hovered}
          />
        );
      })}
    </div>
  );
}
