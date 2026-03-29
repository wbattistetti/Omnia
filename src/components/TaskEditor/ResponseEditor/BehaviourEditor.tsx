import React from 'react';
import StepEditor from '@responseEditor/features/step-management/components/StepEditor';
import { stepMeta } from '@responseEditor/ddtUtils';
import { useBehaviourUi } from '@responseEditor/behaviour/BehaviourUiContext';

interface BehaviourEditorProps {
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
}

/**
 * Step body for the Behaviour tab: reads selected step from BehaviourUiProvider
 * (StepsStrip lives in BehaviourContainer only).
 */
export default function BehaviourEditor({
  node,
  translations,
  updateSelectedNode,
}: BehaviourEditorProps) {
  const { uiStepKeys, selectedStepKey } = useBehaviourUi();

  const getEscalationsFromNode = (n: any, stepKey: string): any[] => {
    if (!n?.steps) return [{ tasks: [] }];

    if (!Array.isArray(n.steps) && n.steps[stepKey]) {
      const esc = n.steps[stepKey].escalations || [];
      return esc.length > 0 ? esc : [{ tasks: [] }];
    }

    if (Array.isArray(n.steps)) {
      let step = n.steps.find((s: any) => s?.type === stepKey);

      if (!step) {
        step = n.steps.find((s: any) => {
          if (!s?.templateStepId) return false;
          const stepType = s.templateStepId.split(':').pop();
          return stepType === stepKey;
        });
      }

      const esc = step?.escalations || [];
      return esc.length > 0 ? esc : [{ tasks: [] }];
    }

    return [{ tasks: [] }];
  };

  const escalations = getEscalationsFromNode(node, selectedStepKey);

  const meta = (stepMeta as any)[selectedStepKey];
  const color = meta?.color || '#fb923c';
  const allowedActions =
    selectedStepKey === 'introduction'
      ? ['playJingle', 'sayMessage', 'SayMessage', 'message', 'Message']
      : undefined;

  if (!uiStepKeys.length) {
    return (
      <div style={{ padding: 16, color: '#64748b', fontStyle: 'italic' }}>
        No steps available for this node.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
