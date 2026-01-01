import React from 'react';
import EscalationEditor from './EscalationEditor';

type Props = {
  escalations: any[]; // ✅ Lista delle escalations (fonte di verità)
  translations: Record<string, string>;
  color?: string;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void; // ✅ Aggiorna direttamente selectedNode
  stepKey: string; // ✅ Step key corrente
};

export default function StepEditor({
  escalations,
  translations,
  color = '#fb923c',
  allowedActions,
  updateSelectedNode,
  stepKey
}: Props) {
  // ✅ Stato per gestire quale task editare automaticamente (condiviso tra escalations)
  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; actIdx: number } | null>(null);

  return (
    <div className="step-editor" style={{ padding: '1rem' }}>
      {escalations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No escalations
        </div>
      ) : (
        escalations.map((esc, idx) => (
          <EscalationEditor
            key={idx}
            escalation={esc}
            escalationIdx={idx}
            translations={translations}
            color={color}
            allowedActions={allowedActions}
            updateSelectedNode={updateSelectedNode}
            stepKey={stepKey}
            autoEditTarget={autoEditTarget}
            onAutoEditTargetChange={setAutoEditTarget}
          />
        ))
      )}
    </div>
  );
}
