import React, { useState, useMemo, useEffect } from 'react';
import StepsStrip from './StepsStrip';
import StepEditor from './features/step-management/components/StepEditor';
import { getNodeStepKeys } from './core/domain';
import { stepMeta } from './ddtUtils';

interface BehaviourEditorProps {
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, notifyProvider?: boolean) => void;
  selectedRoot?: boolean;
  selectedSubIndex?: number | null;
}

export default function BehaviourEditor({
  node,
  translations,
  updateSelectedNode,
  selectedRoot,
  selectedSubIndex,
}: BehaviourEditorProps) {
  // Calcola gli step keys disponibili per questo nodo
  const stepKeys = useMemo(() => {
    if (selectedRoot) {
      return ['introduction'];
    }
    const steps = node ? getNodeStepKeys(node) : [];
    return steps;
  }, [node, selectedRoot, selectedSubIndex]);

  // Append V2 notConfirmed for main node if present (not for root)
  const uiStepKeys = useMemo(() => {
    let result: string[];
    if (selectedRoot) {
      result = stepKeys;
    } else if (selectedSubIndex != null) {
      result = stepKeys;
    } else if (!stepKeys.includes('notConfirmed')) {
      result = [...stepKeys, 'notConfirmed'];
    } else {
      result = stepKeys;
    }
    return result;
  }, [stepKeys, selectedSubIndex, selectedRoot]);

  // Stato locale per lo step selezionato
  const [selectedStepKey, setSelectedStepKey] = useState<string>(() => {
    if (uiStepKeys.length > 0) {
      return uiStepKeys[0];
    }
    return 'start';
  });

  // Aggiorna selectedStepKey quando cambiano gli step disponibili
  useEffect(() => {
    if (uiStepKeys.length > 0 && !uiStepKeys.includes(selectedStepKey)) {
      setSelectedStepKey(uiStepKeys[0]);
    }
  }, [uiStepKeys, selectedStepKey]);

  // ✅ Helper per estrarre escalations dal node
  const getEscalationsFromNode = (node: any, stepKey: string): any[] => {
    if (!node?.steps) return [{ tasks: [] }]; // Default: una escalation vuota

    // ✅ RETROCOMPATIBILITÀ: Gestisce formato dictionary legacy
    if (!Array.isArray(node.steps) && node.steps[stepKey]) {
      const esc = node.steps[stepKey].escalations || [];
      return esc.length > 0 ? esc : [{ tasks: [] }];
    }

    // ✅ NUOVO MODELLO: Array MaterializedStep[]
    if (Array.isArray(node.steps)) {
      // Cerca step per type diretto (se presente)
      let step = node.steps.find((s: any) => s?.type === stepKey);

      // Se non trovato, estrai tipo da templateStepId (formato: `${nodeTemplateId}:${stepKey}`)
      if (!step) {
        step = node.steps.find((s: any) => {
          if (!s?.templateStepId) return false;
          // Estrai il tipo step da templateStepId (ultima parte dopo ':')
          const stepType = s.templateStepId.split(':').pop();
          return stepType === stepKey;
        });
      }

      const esc = step?.escalations || [];
      return esc.length > 0 ? esc : [{ tasks: [] }];
    }

    return [{ tasks: [] }];
  };

  // ✅ Leggi direttamente dal node (senza useMemo - React rileva automaticamente i cambiamenti)
  const escalations = getEscalationsFromNode(node, selectedStepKey);

  // ✅ Cambio step: cambia semplicemente lo step selezionato
  // Non serve salvare perché selectedNode è sempre aggiornato
  const handleStepChange = React.useCallback((newStepKey: string) => {
    if (newStepKey === selectedStepKey) return;
    setSelectedStepKey(newStepKey);
  }, [selectedStepKey]);

  // ✅ Meta per color e allowedActions
  const meta = (stepMeta as any)[selectedStepKey];
  const color = meta?.color || '#fb923c';
  const allowedActions = selectedStepKey === 'introduction' ? ['playJingle', 'sayMessage'] : undefined;

  if (!uiStepKeys.length) {
    return (
      <div style={{ padding: 16, color: '#64748b', fontStyle: 'italic' }}>
        No steps available for this node.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', overflow: 'hidden' }}>
      {/* StepsStrip in alto */}
      <div style={{ borderBottom: '1px solid #1f2340', background: '#0f1422' }}>
        <StepsStrip
          stepKeys={uiStepKeys}
          selectedStepKey={selectedStepKey}
          onSelectStep={handleStepChange}
          node={node}
        />
      </div>

      {/* StepEditor sotto */}
      <StepEditor
        escalations={escalations}
        translations={translations}
        color={color}
        allowedActions={allowedActions}
        updateSelectedNode={updateSelectedNode}
        stepKey={selectedStepKey}
      />
    </div>
  );
}
