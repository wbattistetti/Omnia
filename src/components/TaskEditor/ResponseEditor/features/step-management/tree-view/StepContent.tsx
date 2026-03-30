import React, { useState } from 'react';
import { EscalationCard } from '@responseEditor/components/EscalationCard/EscalationCard';
import { useEscalationUpdate } from '@responseEditor/hooks/useEscalationUpdate';
import { getEscalationName } from '@responseEditor/utils/escalationHelpers';
import { hasEscalationCard, stepMeta } from '@responseEditor/ddtUtils';
import { EscalationFascia } from './EscalationFascia';
import { useEscalationCollapse } from './hooks/useEscalationCollapse';

/** Tooltip for + on colored strip (tree view). */
export const TREE_ADD_ESCALATION_TOOLTIP =
  "Aggiungi un'escalation: un altro gruppo parallelo di azioni per questo step (stesso tipo di step, ordine di esecuzione separato).";

/** Tooltip for trash on colored strip (tree view). */
export const TREE_DELETE_ESCALATION_TOOLTIP =
  'Rimuovi questa escalation (gruppo parallelo di azioni). Serve almeno un escalation per lo step.';

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
  showAddEscalationButton: boolean;
  onAddEscalation?: () => void;
  showDeleteEscalationButton: boolean;
  onDeleteEscalationFromStrip?: () => void;
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
  showAddEscalationButton,
  onAddEscalation,
  showDeleteEscalationButton,
  onDeleteEscalationFromStrip,
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
      showAddEscalationButton={showAddEscalationButton}
      onAddEscalation={onAddEscalation}
      addEscalationTooltip={TREE_ADD_ESCALATION_TOOLTIP}
      showDeleteEscalationButton={showDeleteEscalationButton}
      onDeleteEscalation={onDeleteEscalationFromStrip}
      deleteEscalationTooltip={TREE_DELETE_ESCALATION_TOOLTIP}
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
  /** From useStepActions — adds an escalation lane for this step (tree view + button). */
  onAddEscalation?: (stepKey: string) => void;
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
  onAddEscalation,
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
        const showAddOnStrip =
          Boolean(onAddEscalation) &&
          hasEscalationCard(stepKey) &&
          idx === escalations.length - 1;
        const showDeleteOnStrip =
          hasEscalationCard(stepKey) && escalations.length > 1;

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
            showAddEscalationButton={showAddOnStrip}
            onAddEscalation={showAddOnStrip ? () => onAddEscalation?.(stepKey) : undefined}
            showDeleteEscalationButton={showDeleteOnStrip}
            onDeleteEscalationFromStrip={
              showDeleteOnStrip ? () => onDeleteEscalation(idx) : undefined
            }
          />
        );
      })}
    </div>
  );
}
