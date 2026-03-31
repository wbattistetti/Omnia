/**
 * Resolves the effective DataContract for a flowchart tree node given the owning task document.
 * SubTasks-tree documents use `node.dataContract` when embedded; template-backed rows use cache merge.
 */

import type { Task } from '@types/taskTypes';
import type { DataContract } from '@components/DialogueDataEngine/contracts/contractLoader';
import { loadDataContractFromTemplateCache } from '@responseEditor/ContractSelector/contractTemplateLoad';
import DialogueTaskService from '@services/DialogueTaskService';
import { hasValidTemplateIdRef, taskRowUsesSubTasksContract } from '@utils/taskKind';

function cloneContract(c: DataContract): DataContract {
  try {
    return JSON.parse(JSON.stringify(c)) as DataContract;
  } catch {
    return c;
  }
}

/**
 * If the node snapshot omits testPhrases but the catalogue template has them, merge.
 * Avoids losing GrammarFlow test phrases when the tree node was not updated (legacy bug).
 */
function mergeTestPhrasesFromTemplateIfMissing(
  task: Task,
  nodeContract: DataContract
): DataContract {
  if (nodeContract.testPhrases !== undefined) {
    return nodeContract;
  }
  const tpl = DialogueTaskService.getTemplate(String(task.templateId));
  const tp = tpl?.dataContract?.testPhrases;
  if (Array.isArray(tp) && tp.length > 0) {
    return { ...nodeContract, testPhrases: [...tp] };
  }
  return nodeContract;
}

/**
 * Returns the effective contract for this node when the task row is known.
 * - `taskRowUsesSubTasksContract`: node.dataContract on the instance tree.
 * - Template-backed (`task.templateId` catalogue ref): node.dataContract if set, else template merge from cache.
 */
export function resolveNodeDataContract(task: Task | null | undefined, node: any): DataContract | null {
  if (!node) return null;

  if (task && taskRowUsesSubTasksContract(task)) {
    if (node.dataContract && typeof node.dataContract === 'object') {
      return cloneContract(node.dataContract as DataContract);
    }
    return null;
  }

  if (task && hasValidTemplateIdRef(task)) {
    if (node.dataContract && typeof node.dataContract === 'object') {
      const cloned = cloneContract(node.dataContract as DataContract);
      return mergeTestPhrasesFromTemplateIfMissing(task, cloned);
    }
    return loadDataContractFromTemplateCache(String(task.templateId), node);
  }

  return null;
}
