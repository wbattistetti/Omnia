import React, { useState, useMemo, useEffect } from 'react';
import StepsStrip from '@responseEditor/StepsStrip';
import StepEditor from '@responseEditor/features/step-management/components/StepEditor';
import { StepTreeView } from '@responseEditor/features/step-management/tree-view/StepTreeView';
import { getNodeStepKeys } from '@responseEditor/core/domain';
import { stepMeta } from '@responseEditor/ddtUtils';
import { useResponseEditorContext } from '@responseEditor/context/ResponseEditorContext';
import { useResponseEditorNavigation } from '@responseEditor/context/ResponseEditorNavigationContext';
import { LayoutGrid, List } from 'lucide-react';

interface BehaviourEditorProps {
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  selectedRoot?: boolean;
  selectedSubIndex?: number | null;
  /** When set, depth > 1 behaves like sub selection for step UI. */
  selectedPath?: number[];
  // ✅ NEW: Props per gestire StepsStrip esternamente
  hideStepsStrip?: boolean; // Se true, non mostra StepsStrip (gestito dal container)
  selectedStepKey?: string; // Step selezionato (se gestito esternamente)
  onStepChange?: (stepKey: string) => void; // Callback per cambio step (se gestito esternamente)
}

export default function BehaviourEditor({
  node,
  translations,
  updateSelectedNode,
  selectedRoot,
  selectedSubIndex,
  selectedPath,
  hideStepsStrip = false,
  selectedStepKey: externalSelectedStepKey,
  onStepChange: externalOnStepChange,
}: BehaviourEditorProps) {
  const { taskId } = useResponseEditorContext();

  // Toggle vista: tab o tree
  const [viewMode, setViewMode] = useState<'tabs' | 'tree'>('tabs');

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
    } else if ((selectedPath && selectedPath.length > 1) || selectedSubIndex != null) {
      result = stepKeys;
    } else if (!stepKeys.includes('notConfirmed')) {
      result = [...stepKeys, 'notConfirmed'];
    } else {
      result = stepKeys;
    }
    return result;
  }, [stepKeys, selectedSubIndex, selectedPath, selectedRoot]);

  // ✅ NEW: Get navigation context for programmatic step changes
  const navigation = useResponseEditorNavigation();

  // ✅ Stato locale per lo step selezionato (usato solo se non gestito esternamente)
  const [internalSelectedStepKey, setInternalSelectedStepKey] = useState<string>(() => {
    if (uiStepKeys.length > 0) {
      return uiStepKeys[0];
    }
    return 'start';
  });

  // ✅ Usa step esterno se fornito, altrimenti interno
  const selectedStepKey = externalSelectedStepKey ?? internalSelectedStepKey;
  const setSelectedStepKey = externalOnStepChange ?? setInternalSelectedStepKey;

  // ✅ Push local step to navigation context (one-way only).
  // BehaviourContainer is responsible for reading navigation.currentStepKey and updating
  // selectedStepKey when programmatic navigation (navigateToStep) is triggered.
  // DO NOT also read navigation.currentStepKey here — that creates a feedback loop that
  // reverts the user's click (old context value !== new local value → reverts to old).
  useEffect(() => {
    navigation.setCurrentStepKey(selectedStepKey);
  }, [selectedStepKey, navigation.setCurrentStepKey]);

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
    // ✅ Se è gestito esternamente, usa il callback diretto
    if (externalOnStepChange) {
      externalOnStepChange(newStepKey);
    } else {
      // ✅ Altrimenti usa il setter interno
      setInternalSelectedStepKey(newStepKey);
    }
  }, [selectedStepKey, externalOnStepChange]);

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Toggle vista */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '8px 16px',
        borderBottom: '1px solid #1f2340',
        background: '#0f1422',
        gap: '8px'
      }}>
        <button
          onClick={() => setViewMode('tabs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            border: `1px solid ${viewMode === 'tabs' ? '#3b82f6' : '#6b7280'}`,
            background: viewMode === 'tabs' ? 'rgba(59,130,246,0.1)' : 'transparent',
            color: viewMode === 'tabs' ? '#3b82f6' : '#6b7280',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s'
          }}
          title="Vista tab"
        >
          <List size={14} />
          <span>Tab</span>
        </button>
        <button
          onClick={() => setViewMode('tree')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            border: `1px solid ${viewMode === 'tree' ? '#3b82f6' : '#6b7280'}`,
            background: viewMode === 'tree' ? 'rgba(59,130,246,0.1)' : 'transparent',
            color: viewMode === 'tree' ? '#3b82f6' : '#6b7280',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.2s'
          }}
          title="Vista albero"
        >
          <LayoutGrid size={14} />
          <span>Albero</span>
        </button>
      </div>

      {/* Vista condizionale */}
      {viewMode === 'tabs' ? (
        <>
          {/* StepsStrip in alto - solo se non nascosto */}
          {!hideStepsStrip && (
            <div style={{ borderBottom: '1px solid #1f2340', background: '#0f1422' }}>
              <StepsStrip
                stepKeys={uiStepKeys}
                selectedStepKey={selectedStepKey}
                onSelectStep={handleStepChange}
                node={node}
                taskId={taskId}
              />
            </div>
          )}

          {/* StepEditor sotto */}
          <StepEditor
            escalations={escalations}
            translations={translations}
            color={color}
            allowedActions={allowedActions}
            updateSelectedNode={updateSelectedNode}
            stepKey={selectedStepKey}
          />
        </>
      ) : (
        <StepTreeView
          stepKeys={uiStepKeys}
          node={node}
          translations={translations}
          updateSelectedNode={updateSelectedNode}
          taskId={taskId}
        />
      )}
    </div>
  );
}
