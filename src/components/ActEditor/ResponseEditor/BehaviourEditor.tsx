import React, { useState, useMemo, useEffect } from 'react';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
import { getNodeSteps } from './ddtSelectors';
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
    const steps = node ? getNodeSteps(node) : [];
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

    if (!Array.isArray(node.steps) && node.steps[stepKey]) {
      const esc = node.steps[stepKey].escalations || [];
      return esc.length > 0 ? esc : [{ tasks: [] }];
    }

    if (Array.isArray(node.steps)) {
      const step = node.steps.find((s: any) => s?.type === stepKey);
      const esc = step?.escalations || [];
      return esc.length > 0 ? esc : [{ tasks: [] }];
    }

    return [{ tasks: [] }];
  };

  // ✅ UNICA FONTE DI VERITÀ: leggi direttamente dal node
  // Usa useMemo per evitare ricalcoli inutili e garantire che si aggiorni quando node cambia
  const escalations = useMemo(() => {
    return getEscalationsFromNode(node, selectedStepKey);
  }, [node, selectedStepKey]);

  // ✅ Salva escalations nel node (commit atomico) - gestisce sia array che oggetto
  // Crea sempre nuovi riferimenti per garantire che React rilevi i cambiamenti
  const saveEscalationsToNode = React.useCallback((stepKey: string, escalationsToSave: any[]) => {
    updateSelectedNode((node) => {
      const next = { ...node }; // ✅ Nuovo riferimento per node

      // Gestisce entrambi i formati: array o oggetto
      if (Array.isArray(node.steps)) {
        // Formato array: [{ type: 'start', escalations: [...] }, ...]
        const stepIdx = node.steps.findIndex((s: any) => s?.type === stepKey);
        if (stepIdx >= 0) {
          next.steps = [...node.steps]; // ✅ Nuovo array
          next.steps[stepIdx] = {
            ...next.steps[stepIdx], // ✅ Nuovo oggetto step
            escalations: escalationsToSave
          };
        } else {
          // Crea nuovo step se non esiste
          next.steps = [...(node.steps || []), { type: stepKey, escalations: escalationsToSave }];
        }
      } else {
        // Formato oggetto: { start: { escalations: [...] }, ... }
        next.steps = { ...(node.steps || {}) }; // ✅ Nuovo oggetto
        if (!next.steps[stepKey]) {
          next.steps[stepKey] = { type: stepKey };
        }
        next.steps[stepKey] = {
          ...next.steps[stepKey], // ✅ Nuovo oggetto step
          escalations: escalationsToSave
        };
      }

      return next; // ✅ Sempre un nuovo riferimento
    });
  }, [updateSelectedNode]);

  // ✅ Cambio step: salva le escalations correnti PRIMA di cambiare step
  // Questo garantisce che le modifiche non vengano perse quando cambi step
  const handleStepChange = React.useCallback((newStepKey: string) => {
    // Se stiamo già nello step che vogliamo selezionare, non fare nulla
    if (newStepKey === selectedStepKey) return;

    // ✅ Leggi escalations direttamente da node (fonte di verità)
    // selectedNode è sempre aggiornato, quindi node contiene sempre i dati più recenti
    const currentEscalations = getEscalationsFromNode(node, selectedStepKey);

    // Salva le escalations correnti PRIMA di cambiare step
    saveEscalationsToNode(selectedStepKey, currentEscalations);

    // POI cambia step
    setSelectedStepKey(newStepKey);
  }, [selectedStepKey, saveEscalationsToNode, node]);


  // ✅ Callback: aggiorna SOLO il node
  // Flusso: drop → handleEscalationsChange → saveEscalationsToNode → updateSelectedNode
  // → setSelectedNode (aggiornamento diretto) → React ri-renderizza → prop node aggiornato → useMemo ricalcola escalations
  const handleEscalationsChange = React.useCallback((newEscalations: any[]) => {
    saveEscalationsToNode(selectedStepKey, newEscalations);
  }, [selectedStepKey, saveEscalationsToNode]);

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <StepEditor
          escalations={escalations}
          translations={translations}
          color={color}
          allowedActions={allowedActions}
          onEscalationsChange={handleEscalationsChange}
        />
      </div>
    </div>
  );
}
