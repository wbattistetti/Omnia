import React from 'react';
import EscalationEditor from './EscalationEditor';
import { Plus } from 'lucide-react';
import { stepMeta, hasEscalationCard } from './ddtUtils';
import { updateStepEscalations } from './utils/stepHelpers';

type Props = {
  escalations: any[];
  translations: Record<string, string>;
  color?: string;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
  stepKey: string;
};

export default function StepEditor({
  escalations,
  translations,
  color = '#fb923c',
  allowedActions,
  updateSelectedNode,
  stepKey
}: Props) {
  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; actIdx: number } | null>(null);
  const stepLabel = stepMeta[stepKey]?.label || 'Escalation';

  const handleAddEscalation = React.useCallback(() => {
    updateSelectedNode((node) => {
      return updateStepEscalations(node, stepKey, (escalations) => {
        return [...escalations, { tasks: [] }];
      });
    });
  }, [updateSelectedNode, stepKey]);

  const handleDeleteEscalation = React.useCallback((escalationIdx: number) => {
    updateSelectedNode((node) => {
      return updateStepEscalations(node, stepKey, (escalations) => {
        const updated = [...escalations];
        updated.splice(escalationIdx, 1);
        // Mantieni almeno una escalation vuota
        return updated.length > 0 ? updated : [{ tasks: [] }];
      });
    });
  }, [updateSelectedNode, stepKey]);

  const showEscalationCard = hasEscalationCard(stepKey);

  return (
    <div className="step-editor" style={{ padding: showEscalationCard ? '1rem' : '0' }}>
      {escalations.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          No escalations
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: showEscalationCard ? '1rem' : '0' }}>
          {escalations.map((esc, idx) => (
            <EscalationEditor
              key={idx}
              escalation={esc}
              escalationIdx={idx}
              translations={translations}
              color={color}
              allowedActions={allowedActions}
              updateSelectedNode={updateSelectedNode}
              stepKey={stepKey}
              stepLabel={stepLabel}
              onDeleteEscalation={handleDeleteEscalation}
              autoEditTarget={autoEditTarget}
              onAutoEditTargetChange={setAutoEditTarget}
            />
          ))}
        </div>
      )}

      {/* ✅ Pulsante "+" per aggiungere escalation - mostrato solo se lo step supporta escalation multiple */}
      {showEscalationCard && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleAddEscalation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: `1px dashed ${color}`,
              borderRadius: '8px',
              color: color,
              cursor: 'pointer',
              fontSize: '0.875rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${color}15`;
              e.currentTarget.style.borderColor = color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = color;
            }}
          >
            <Plus size={16} />
            <span>Aggiungi escalation</span>
          </button>
        </div>
      )}
    </div>
  );
}
