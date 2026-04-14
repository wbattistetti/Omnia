/**
 * ReferencedTaskVariables: VarIds referenced from the moved task (§3 structural walk + UUID tokens).
 */

import { taskRepository } from '@services/TaskRepository';
import {
  buildLowercaseToCanonicalVarIdMap,
  extractKnownVarIdsFromText,
  extractReferencedVarIdsFromTaskObject,
} from '../taskSubflowMove/referenceScanStructural';
import type { ReferencedTaskVariables, VarId } from '../guidModel/types';

/**
 * Structural scan of the persisted task for the moved row: same rules as parent flow task walk.
 */
export function referencedTaskVariablesForMovedTask(
  taskInstanceId: string,
  knownProjectVarIds: ReadonlySet<string>
): ReferencedTaskVariables {
  const tid = String(taskInstanceId || '').trim();
  if (!tid) return new Set();
  const task = taskRepository.getTask(tid);
  if (!task) return new Set();
  const map = buildLowercaseToCanonicalVarIdMap(knownProjectVarIds);
  const raw = extractReferencedVarIdsFromTaskObject(task, map);
  const out = new Set<VarId>();
  for (const id of raw) out.add(id as VarId);
  return out;
}

/**
 * @param movedTaskCorpus — legacy: serialized task JSON (token extraction only; prefer {@link referencedTaskVariablesForMovedTask}).
 */
export function referencedTaskVariablesFromMovedCorpus(
  movedTaskCorpus: string,
  knownProjectVarIds: ReadonlySet<string>
): ReferencedTaskVariables {
  const map = buildLowercaseToCanonicalVarIdMap(knownProjectVarIds);
  const raw = extractKnownVarIdsFromText(movedTaskCorpus, map);
  const out = new Set<VarId>();
  for (const id of raw) out.add(id as VarId);
  return out;
}
