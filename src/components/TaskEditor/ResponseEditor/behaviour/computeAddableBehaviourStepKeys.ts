/**
 * Optional behaviour step types: "create" when absent from instance+node;
 * disabled instance rows are offered separately via buildUnifiedBehaviourAddMenuItems (restore).
 */

import { getStepOrder } from '@types/stepTypes';

export function getOptionalBehaviourStepTypeCandidates(
  selectedRoot: boolean,
  selectedPath: number[] | undefined,
  selectedSubIndex: number | null | undefined
): string[] {
  if (selectedRoot) return [];
  const isSub =
    (selectedPath != null && selectedPath.length > 1) || selectedSubIndex != null;
  if (isSub) {
    return ['noInput', 'invalid'];
  }
  return ['noInput', 'confirmation', 'notConfirmed', 'invalid', 'success'];
}

export function computeAddableBehaviourStepKeys(
  stepTypeCandidates: string[],
  instanceSteps: Record<string, { _disabled?: boolean } | undefined> | undefined,
  nodeStepsDict: Record<string, unknown> | undefined
): string[] {
  const slice = instanceSteps && typeof instanceSteps === 'object' ? instanceSteps : {};
  const nodeDict =
    nodeStepsDict && typeof nodeStepsDict === 'object' && !Array.isArray(nodeStepsDict)
      ? nodeStepsDict
      : {};
  return stepTypeCandidates.filter((stepKey) => {
    const fromRepo = slice[stepKey];
    if (fromRepo && fromRepo._disabled === true) return false;
    if (fromRepo) return false;
    if (nodeDict[stepKey] != null) return false;
    return true;
  });
}

export type UnifiedAddMenuItem =
  | { stepKey: string; mode: 'create' }
  | { stepKey: string; mode: 'restore'; stepData: unknown };

/**
 * Single ADD menu: create missing optional steps, or restore any step disabled in the task instance.
 */
export function buildUnifiedBehaviourAddMenuItems(
  selectedRoot: boolean,
  selectedPath: number[] | undefined,
  selectedSubIndex: number | null | undefined,
  instanceSteps: Record<string, { _disabled?: boolean } | undefined> | undefined,
  nodeStepsDict: Record<string, unknown> | undefined
): UnifiedAddMenuItem[] {
  const candidates = getOptionalBehaviourStepTypeCandidates(
    selectedRoot,
    selectedPath,
    selectedSubIndex
  );
  const createKeys = computeAddableBehaviourStepKeys(candidates, instanceSteps, nodeStepsDict);
  const createItems: UnifiedAddMenuItem[] = createKeys.map((stepKey) => ({ stepKey, mode: 'create' }));

  const slice =
    instanceSteps && typeof instanceSteps === 'object' ? instanceSteps : {};
  const restoreItems: UnifiedAddMenuItem[] = [];
  for (const stepKey of Object.keys(slice)) {
    const stepData = slice[stepKey];
    if (stepData && stepData._disabled === true) {
      restoreItems.push({ stepKey, mode: 'restore', stepData });
    }
  }

  const createKeySet = new Set(createKeys);
  const merged: UnifiedAddMenuItem[] = [
    ...createItems,
    ...restoreItems.filter((r) => !createKeySet.has(r.stepKey)),
  ];

  merged.sort((a, b) => getStepOrder(a.stepKey) - getStepOrder(b.stepKey));
  return merged;
}
