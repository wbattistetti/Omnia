/**
 * When VariableCreationService has no rows yet for a moved task, derives the same variable GUIDs
 * from the task repository tree (utterance / classify) so child flowInterface.output can still merge.
 */

import type { WorkspaceState } from '@flows/FlowTypes';
import { TaskType, isUtteranceInterpretationTask } from '@types/taskTypes';
import type { VariableInstance } from '@types/variableTypes';
import { taskRepository } from '@services/TaskRepository';
import { buildStandaloneTaskTreeView } from '@utils/buildStandaloneTaskTreeView';
import { getMainNodes } from '@responseEditor/core/domain';
import { flattenUtteranceTaskTreeVariableRows } from '@utils/utteranceTaskVariableSync';
import { logS2Diag } from '@utils/s2WiringDiagnostic';

/**
 * Builds minimal {@link VariableInstance} rows from the persisted task tree when the in-memory
 * store has not hydrated yet (first pass before variableStore:updated).
 */
export function inferTaskVariableInstancesForSubflowInterfaceMerge(
  taskInstanceId: string,
  childFlowId: string,
  flows: WorkspaceState['flows']
): VariableInstance[] {
  const tid = String(taskInstanceId || '').trim();
  const cid = String(childFlowId || '').trim();
  if (!tid || !cid) return [];

  const task = taskRepository.getTask(tid);
  if (!task) {
    logS2Diag('inferTaskVars', 'nessun task in TaskRepository', { taskInstanceId: tid, childFlowId: cid });
    return [];
  }

  const utteranceLike =
    isUtteranceInterpretationTask(task) || task.type === TaskType.ClassifyProblem;
  if (!utteranceLike) {
    logS2Diag('inferTaskVars', 'tipo task non inferibile (solo utterance/classify)', {
      taskInstanceId: tid,
      taskType: task.type,
    });
    return [];
  }

  const tree = buildStandaloneTaskTreeView(task);
  if (!tree) {
    logS2Diag('inferTaskVars', 'buildStandaloneTaskTreeView null', { taskInstanceId: tid });
    return [];
  }

  const mains = getMainNodes(tree);
  if (!mains.length) {
    logS2Diag('inferTaskVars', 'getMainNodes vuoto', { taskInstanceId: tid });
    return [];
  }

  const flat = flattenUtteranceTaskTreeVariableRows(mains);

  return flat.map(
    (r) =>
      ({
        id: r.id,
        taskInstanceId: tid,
        dataPath: r.dataPath,
        scope: 'flow',
        scopeFlowId: cid,
      }) as VariableInstance
  );
}

/**
 * S2: union of store + inferred rows by variable id; store rows win on collision (authoring overrides inference).
 * Output order is deterministic (lexicographic by id).
 */
export function mergeVariableRowsByIdPreferStore(
  storeRows: VariableInstance[],
  inferredRows: VariableInstance[]
): VariableInstance[] {
  const map = new Map<string, VariableInstance>();
  for (const v of inferredRows) {
    const id = String(v.id || '').trim();
    if (id) map.set(id, v);
  }
  for (const v of storeRows) {
    const id = String(v.id || '').trim();
    if (id) map.set(id, v);
  }
  return [...map.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
}
