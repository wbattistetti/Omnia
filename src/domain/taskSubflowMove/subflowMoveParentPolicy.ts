/**
 * Parent-flow policy for task → subflow move: partition of moved-task variables vs §4E
 * (`docs/SEMANTICA_TASK_VARIABLES_E_SUBFLOW.md`).
 */

export type MovedTaskReferencePartition = {
  /** `taskVarId ∩ variabiliReferenziate` (parent) */
  referencedForMovedTask: string[];
  /** Task-bound var ids not referenced anywhere in the parent flow */
  unreferencedForMovedTask: string[];
  /** Same ids as `referencedForMovedTask`, for set operations */
  referencedSet: ReadonlySet<string>;
};

/**
 * §4E steps 1–2: from full-parent `variabiliReferenziate` and the moved task’s variable ids,
 * compute which task vars stay referenced in the parent vs can be pruned there.
 */
export function partitionMovedTaskVariableIdsByParentReference(
  taskVarIdSet: ReadonlySet<string>,
  referencedInParent: ReadonlySet<string>
): MovedTaskReferencePartition {
  const referencedForMovedTask: string[] = [];
  for (const id of referencedInParent) {
    const v = String(id || '').trim();
    if (v && taskVarIdSet.has(v)) referencedForMovedTask.push(v);
  }
  referencedForMovedTask.sort();

  const refSet = new Set(referencedForMovedTask);
  const unreferencedForMovedTask: string[] = [];
  for (const id of taskVarIdSet) {
    const v = String(id || '').trim();
    if (!v) continue;
    if (!refSet.has(v)) unreferencedForMovedTask.push(v);
  }
  unreferencedForMovedTask.sort();

  return {
    referencedForMovedTask,
    unreferencedForMovedTask,
    referencedSet: refSet,
  };
}

/**
 * Variable ids to wire for S2 (OUTPUT rows, `subflowBindings`, parent rename): all task vars or referenced-only.
 */
export function wiringVariableIdsForSubflow(
  s2TaskVarIdsSorted: readonly string[],
  referencedForMovedTaskSorted: readonly string[],
  exposeAllTaskVariablesInChildInterface: boolean
): string[] {
  if (exposeAllTaskVariablesInChildInterface) {
    return [...s2TaskVarIdsSorted];
  }
  return [...referencedForMovedTaskSorted];
}
