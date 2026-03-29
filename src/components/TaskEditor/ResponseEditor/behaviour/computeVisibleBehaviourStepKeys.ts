/**
 * Decides which step tab keys to render in StepsStrip given repository mirror vs editor node.steps.
 */

export function computeVisibleBehaviourStepKeys(
  stepKeys: string[],
  instanceSteps: Record<string, { _disabled?: boolean } | undefined> | undefined,
  nodeStepsDict: Record<string, unknown> | undefined
): string[] {
  const slice = instanceSteps && typeof instanceSteps === 'object' ? instanceSteps : {};

  if (Object.keys(slice).length === 0) {
    return stepKeys;
  }

  const nodeDict =
    nodeStepsDict && typeof nodeStepsDict === 'object' && !Array.isArray(nodeStepsDict)
      ? nodeStepsDict
      : {};

  return stepKeys.filter((stepKey) => {
    const fromRepo = slice[stepKey];
    if (fromRepo && fromRepo._disabled === true) return false;
    if (fromRepo) return true;
    return nodeDict[stepKey] != null;
  });
}
