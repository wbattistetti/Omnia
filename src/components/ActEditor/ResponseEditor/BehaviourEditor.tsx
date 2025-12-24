import React, { useState, useMemo } from 'react';
import StepsStrip from './StepsStrip';
import StepEditor from './StepEditor';
import { getNodeSteps } from './ddtSelectors';
import { useNodePersistence } from './hooks/useNodePersistence';

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
      // Root selected: always show 'introduction' (even if empty, to allow creation)
      return ['introduction'];
    }
    const steps = node ? getNodeSteps(node) : [];
    return steps;
  }, [node, selectedRoot, selectedSubIndex]);

  // Append V2 notConfirmed for main node if present (not for root)
  const uiStepKeys = useMemo(() => {
    let result: string[];
    if (selectedRoot) {
      result = stepKeys; // Root doesn't have notConfirmed
    } else if (selectedSubIndex != null) {
      result = stepKeys; // Sub nodes don't have notConfirmed
    } else if (!stepKeys.includes('notConfirmed')) {
      result = [...stepKeys, 'notConfirmed'];
    } else {
      result = stepKeys;
    }
    return result;
  }, [stepKeys, selectedSubIndex, selectedRoot]);

  // Stato locale per lo step selezionato (default: primo step disponibile o 'start')
  const [selectedStepKey, setSelectedStepKey] = useState<string>(() => {
    if (uiStepKeys.length > 0) {
      return uiStepKeys[0];
    }
    return 'start';
  });

  // Aggiorna selectedStepKey quando cambiano gli step disponibili
  React.useEffect(() => {
    if (uiStepKeys.length > 0 && !uiStepKeys.includes(selectedStepKey)) {
      setSelectedStepKey(uiStepKeys[0]);
    }
  }, [uiStepKeys, selectedStepKey]);

  // Hook per normalizzare e persistere il model
  const { normalizeAndPersistModel } = useNodePersistence(selectedStepKey, updateSelectedNode);

  // Handler per eliminare escalation
  const handleDeleteEscalation = (idx: number) => {
    updateSelectedNode((node) => {
      const next = { ...(node || {}), steps: { ...(node?.steps || {}) } };
      const st = next.steps[selectedStepKey] || { type: selectedStepKey, escalations: [] };
      st.escalations = (st.escalations || []).filter((_: any, i: number) => i !== idx);
      next.steps[selectedStepKey] = st;
      return next;
    });
  };

  // Handler per eliminare action
  const handleDeleteAction = (escIdx: number, actionIdx: number) => {
    updateSelectedNode((node) => {
      const next = { ...(node || {}), steps: { ...(node?.steps || {}) } };
      const st = next.steps[selectedStepKey] || { type: selectedStepKey, escalations: [] };
      const esc = (st.escalations || [])[escIdx];
      if (!esc) return next;
      esc.actions = (esc.actions || []).filter((_: any, j: number) => j !== actionIdx);
      st.escalations[escIdx] = esc;
      next.steps[selectedStepKey] = st;
      return next;
    });
  };

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
          onSelectStep={setSelectedStepKey}
          node={node}
        />
      </div>

      {/* StepEditor sotto */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <StepEditor
          node={node}
          stepKey={selectedStepKey}
          translations={translations}
          onModelChange={normalizeAndPersistModel}
          onDeleteEscalation={handleDeleteEscalation}
          onDeleteAction={handleDeleteAction}
        />
      </div>
    </div>
  );
}

