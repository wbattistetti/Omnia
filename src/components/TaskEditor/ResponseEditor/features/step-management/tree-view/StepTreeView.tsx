import React from 'react';
import { StepCard } from './StepCard';
import { useStepActions } from './hooks/useStepActions';
import { buildStepTree, normalizeStepKeys } from './utils/stepTreeHelpers';

interface StepTreeViewProps {
  stepKeys: string[];
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
}

/**
 * Container principale: orchestrazione pura, nessuna UI
 */
export function StepTreeView({
  stepKeys,
  node,
  translations,
  updateSelectedNode,
}: StepTreeViewProps) {
  const normalizedKeys = normalizeStepKeys(stepKeys);
  const stepTree = buildStepTree(node, normalizedKeys);
  const { deleteEscalation } = useStepActions({
    node,
    stepKeys: normalizedKeys,
    updateSelectedNode,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflowY: 'auto',
        position: 'relative',
        padding: '0.5rem',
      }}
    >
      {stepTree.map((item) => {
        const allowedActions =
          item.stepKey === 'introduction' ? ['playJingle', 'sayMessage'] : undefined;

        return (
          <React.Fragment key={item.stepKey}>
            <StepCard
              stepKey={item.stepKey}
              isRoot={item.isRoot}
              escalations={item.escalations}
              color={item.meta.color}
              translations={translations}
              allowedActions={allowedActions}
              updateSelectedNode={updateSelectedNode}
              onDeleteEscalation={(idx) => deleteEscalation(item.stepKey, idx)}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
