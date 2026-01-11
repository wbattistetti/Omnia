import React from 'react';
import { useEscalationUpdate } from './hooks/useEscalationUpdate';
import { EscalationCard } from './components/EscalationCard/EscalationCard';
import { getEscalationName } from './utils/escalationHelpers';

type EscalationEditorProps = {
  escalation: any;
  escalationIdx: number;
  translations: Record<string, string>;
  color?: string;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
  stepKey: string;
  stepLabel: string; // ✅ Label dello step (es. "Non capisco", "Non sento")
  onDeleteEscalation?: (escalationIdx: number) => void; // ✅ Handler per cancellare escalation
  autoEditTarget: { escIdx: number; taskIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; taskIdx: number } | null) => void;
};

export default function EscalationEditor({
  escalation,
  escalationIdx,
  translations,
  color = '#fb923c',
  allowedActions,
  updateSelectedNode,
  stepKey,
  stepLabel,
  onDeleteEscalation,
  autoEditTarget,
  onAutoEditTargetChange
}: EscalationEditorProps) {
  const { updateEscalation } = useEscalationUpdate(updateSelectedNode, stepKey, escalationIdx);
  const escalationName = getEscalationName(stepLabel, escalationIdx);

  return (
    <EscalationCard
      escalation={escalation}
      escalationIdx={escalationIdx}
      escalationName={escalationName}
      color={color}
      translations={translations}
      allowedActions={allowedActions}
      updateEscalation={updateEscalation}
      updateSelectedNode={updateSelectedNode}
      onDeleteEscalation={onDeleteEscalation ? () => onDeleteEscalation(escalationIdx) : undefined}
      autoEditTarget={autoEditTarget}
      onAutoEditTargetChange={onAutoEditTargetChange}
      stepKey={stepKey}
    />
  );
}
