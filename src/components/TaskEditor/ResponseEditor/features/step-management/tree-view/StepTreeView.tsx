import React from 'react';
import { StepCard } from './StepCard';
import { StepActionsToolbar } from './StepActionsToolbar';
import { useStepCollapse } from './hooks/useStepCollapse';
import { useStepActions } from './hooks/useStepActions';
import { useStepFasciaHover } from './hooks/useStepFasciaHover';
import { buildStepTree, normalizeStepKeys } from './utils/stepTreeHelpers';
import { getAvailableSteps } from './utils/stepOrderUtils';
import { useResponseEditorNavigation } from '@responseEditor/context/ResponseEditorNavigationContext';

interface StepTreeViewProps {
  stepKeys: string[];
  node: any;
  translations: Record<string, string>;
  updateSelectedNode: (updater: (node: any) => any, options?: { skipAutoSave?: boolean }) => void;
  taskId?: string;
}

/**
 * Container principale: orchestrazione pura, nessuna UI
 */
export function StepTreeView({
  stepKeys,
  node,
  translations,
  updateSelectedNode,
  taskId
}: StepTreeViewProps) {
  const navigation = useResponseEditorNavigation();

  // Normalizza e ordina step keys
  const normalizedKeys = normalizeStepKeys(stepKeys);

  // Costruisce albero step → escalation
  const stepTree = buildStepTree(node, normalizedKeys);

  // Hooks
  const { isCollapsed, toggleCollapse } = useStepCollapse(normalizedKeys);
  const { addStep, deleteStep, addEscalation, deleteEscalation } = useStepActions({
    node,
    stepKeys: normalizedKeys,
    updateSelectedNode
  });
  const {
    hoveredStepKey,
    toolbarPosition,
    registerFasciaRef,
    handleMouseEnter,
    handleMouseLeave
  } = useStepFasciaHover();

  // Auto-edit target dal context
  const autoEditTarget = navigation?.autoEditTarget || null;
  const setAutoEditTarget = navigation?.setAutoEditTarget;

  // Step disponibili per aggiunta
  const availableSteps = getAvailableSteps(normalizedKeys);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflowY: 'auto',
        position: 'relative', // Importante per calcolo drop zone corretto
        padding: '0.5rem'
      }}
    >
      {stepTree.map((item, index) => {
        const isRoot = item.isRoot;
        const isMandatory = item.stepKey === 'start';
        const collapsed = isCollapsed(item.stepKey);
        const hovered = hoveredStepKey === item.stepKey;
        const showToolbar = hovered && toolbarPosition !== null;

        // Allowed actions
        const allowedActions = item.stepKey === 'introduction'
          ? ['playJingle', 'sayMessage']
          : undefined;

        return (
          <React.Fragment key={item.stepKey}>
            <StepCard
              stepKey={item.stepKey}
              isRoot={isRoot}
              escalations={item.escalations}
              color={item.meta.color}
              translations={translations}
              allowedActions={allowedActions}
              updateSelectedNode={updateSelectedNode}
              onDeleteEscalation={(idx) => deleteEscalation(item.stepKey, idx)}
              autoEditTarget={autoEditTarget}
              onAutoEditTargetChange={setAutoEditTarget || (() => {})}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}
