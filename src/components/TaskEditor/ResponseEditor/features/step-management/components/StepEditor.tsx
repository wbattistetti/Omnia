import React from 'react';
import { Plus } from 'lucide-react';
import { stepMeta, hasEscalationCard } from '@responseEditor/ddtUtils';
import { updateStepEscalations } from '@responseEditor/utils/stepHelpers';
import { EscalationCard } from '@responseEditor/components/EscalationCard/EscalationCard';
import { useEscalationUpdate } from '@responseEditor/hooks/useEscalationUpdate';
import { getEscalationName } from '@responseEditor/utils/escalationHelpers';

// Force Vite cache refresh

type Props = {
  escalations: any[];
  translations: Record<string, string>;
  color?: string;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  stepKey: string;
};

// Componente interno per gestire il hook useEscalationUpdate
function EscalationCardWrapper({
  escalation,
  escalationIdx,
  stepLabel,
  color,
  translations,
  allowedActions,
  updateSelectedNode,
  stepKey,
  onDeleteEscalation,
  autoEditTarget,
  onAutoEditTargetChange,
}: {
  escalation: any;
  escalationIdx: number;
  stepLabel: string;
  color: string;
  translations: Record<string, string>;
  allowedActions?: string[];
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  stepKey: string;
  onDeleteEscalation?: (escalationIdx: number) => void;
  autoEditTarget: { escIdx: number; taskIdx: number } | null;
  onAutoEditTargetChange: (target: { escIdx: number; taskIdx: number } | null) => void;
}) {
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

export default function StepEditor({
  escalations,
  translations,
  color = '#fb923c',
  allowedActions,
  updateSelectedNode,
  stepKey
}: Props) {
  const [autoEditTarget, setAutoEditTarget] = React.useState<{ escIdx: number; taskIdx: number } | null>(null);
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

  // ✅ Determina modalità: A (single escalation) vs B (multiple escalations)
  const hasMultipleEscalations = escalations.length > 1;
  const isModeA = !showEscalationCard || !hasMultipleEscalations;
  const isModeB = showEscalationCard && hasMultipleEscalations;

  return (
    <div
      className="step-editor"
      style={{
        padding: showEscalationCard ? '1rem' : '0',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ✅ StepContentArea: unico container scrollabile */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {escalations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No escalations
          </div>
        ) : isModeA ? (
          // ✅ Modalità A: DropArea/TaskList diretta (nessun accordion)
          <EscalationCardWrapper
            escalation={escalations[0]}
            escalationIdx={0}
            stepLabel={stepLabel}
            color={color}
            translations={translations}
            allowedActions={allowedActions}
            updateSelectedNode={updateSelectedNode}
            stepKey={stepKey}
            onDeleteEscalation={handleDeleteEscalation}
            autoEditTarget={autoEditTarget}
            onAutoEditTargetChange={setAutoEditTarget}
          />
        ) : (
          // ✅ Modalità B: EscalationsStack (pila di accordion)
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            flex: '0 0 auto',
            minHeight: 'auto'
          }}>
            {escalations.map((esc, idx) => (
              <EscalationCardWrapper
                key={idx}
                escalation={esc}
                escalationIdx={idx}
                stepLabel={stepLabel}
                color={color}
                translations={translations}
                allowedActions={allowedActions}
                updateSelectedNode={updateSelectedNode}
                stepKey={stepKey}
                onDeleteEscalation={handleDeleteEscalation}
                autoEditTarget={autoEditTarget}
                onAutoEditTargetChange={setAutoEditTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* ✅ Pulsante "+" fisso in fondo (fuori dall'area scrollabile) */}
      {showEscalationCard && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
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
