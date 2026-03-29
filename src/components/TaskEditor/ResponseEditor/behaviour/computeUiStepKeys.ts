/**
 * Single source of truth for Behaviour step tab keys shown in StepsStrip.
 * Pure function — testable without React.
 *
 * Step keys are derived without validateNodeStructure so transient array-shaped
 * node.steps (legacy / partial sync) cannot crash BehaviourUiProvider.
 */

export type ComputeUiStepKeysInput = {
  node: unknown;
  selectedRoot: boolean | undefined;
  selectedPath: number[] | undefined;
  selectedSubIndex: number | null | undefined;
};

const INVALID_STEP_TYPES = ['disambiguation', 'violation', 'notAcquired'];

const DEFAULT_STEP_ORDER = [
  'start',
  'introduction',
  'noInput',
  'noMatch',
  'confirmation',
  'notConfirmed',
  'invalid',
  'success',
];

/**
 * Collects step key strings from either dictionary steps or MaterializedStep[].
 */
function rawStepKeysFromNodeSteps(steps: unknown): string[] {
  if (!steps || typeof steps !== 'object') {
    return [];
  }
  if (Array.isArray(steps)) {
    return steps
      .map((s: { type?: string; templateStepId?: string }) => {
        if (typeof s?.type === 'string' && s.type.trim()) {
          return s.type;
        }
        if (typeof s?.templateStepId === 'string' && s.templateStepId.trim()) {
          return s.templateStepId;
        }
        return '';
      })
      .filter((k) => k.length > 0);
  }
  return Object.keys(steps as Record<string, unknown>);
}

/**
 * Same ordering/filter as getNodeStepKeys, without structural validation.
 */
export function orderStepKeysForUi(keys: string[]): string[] {
  const filteredKeys = keys.filter((key) => !INVALID_STEP_TYPES.includes(key));
  const present = filteredKeys.filter((key) => key && key.trim());
  const orderedKnown = DEFAULT_STEP_ORDER.filter((k) => present.includes(k));
  const custom = present.filter((k) => !DEFAULT_STEP_ORDER.includes(k)).sort();
  return [...orderedKnown, ...custom];
}

function extractStepKeysFromNode(node: unknown): string[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  const steps = (node as { steps?: unknown }).steps;
  return orderStepKeysForUi(rawStepKeysFromNodeSteps(steps));
}

export function computeUiStepKeys({
  node,
  selectedRoot,
  selectedPath,
  selectedSubIndex,
}: ComputeUiStepKeysInput): string[] {
  const stepKeys = selectedRoot
    ? ['introduction']
    : node
      ? extractStepKeysFromNode(node)
      : [];

  if (selectedRoot) {
    return stepKeys;
  }
  if ((selectedPath && selectedPath.length > 1) || selectedSubIndex != null) {
    return stepKeys;
  }
  if (!stepKeys.includes('notConfirmed')) {
    return [...stepKeys, 'notConfirmed'];
  }
  return stepKeys;
}
