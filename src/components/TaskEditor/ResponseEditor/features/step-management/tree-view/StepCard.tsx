import React from 'react';
import { StepContent } from './StepContent';

interface StepCardProps {
  stepKey: string;
  isRoot: boolean;
  escalations: any[];
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  onDeleteEscalation: (escalationIdx: number) => void;
  autoEditTarget: { escIdx: number; taskIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; taskIdx: number } | null) => void;
}

/**
 * Card step: layout orizzontale (fascia + contenuto)
 * Solo layout, nessuna logica
 */
export function StepCard({
  stepKey,
  isRoot,
  escalations,
  color,
  translations,
  allowedActions,
  updateSelectedNode,
  onDeleteEscalation,
  autoEditTarget,
  onAutoEditTargetChange
}: StepCardProps) {
  return (
    <div
      style={{
        marginLeft: isRoot ? '0' : '50px', // Indentazione livello 1 per step non-root
        marginBottom: '0.25rem'
      }}
    >
      {/* Contenuto: ogni escalation ha la sua fascia con indentazione progressiva */}
      <StepContent
        stepKey={stepKey}
        escalations={escalations}
        color={color}
        translations={translations}
        allowedActions={allowedActions}
        updateSelectedNode={updateSelectedNode}
        onDeleteEscalation={onDeleteEscalation}
        autoEditTarget={autoEditTarget}
        onAutoEditTargetChange={onAutoEditTargetChange}
      />
    </div>
  );
}
