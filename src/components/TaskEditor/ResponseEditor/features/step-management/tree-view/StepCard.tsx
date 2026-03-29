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
}: StepCardProps) {
  return (
    <div
      style={{
        marginLeft: isRoot ? '0' : '50px',
        marginBottom: '0.25rem',
      }}
    >
      <StepContent
        stepKey={stepKey}
        escalations={escalations}
        color={color}
        translations={translations}
        allowedActions={allowedActions}
        updateSelectedNode={updateSelectedNode}
        onDeleteEscalation={onDeleteEscalation}
      />
    </div>
  );
}
