/**
 * ReferencedTaskVariables: VarIds that appear in the moved task JSON corpus (messages, nested config).
 */

import { extractReferencedVarIdsFromText } from '../taskSubflowMove/collectReferencedVarIds';
import type { ReferencedTaskVariables, VarId } from '../guidModel/types';

/**
 * @param movedTaskCorpus — typically JSON.stringify(task) from TaskRepository
 * @param knownProjectVarIds — restricts matches to real variable GUIDs (avoids node/edge UUID noise)
 */
export function referencedTaskVariablesFromMovedCorpus(
  movedTaskCorpus: string,
  knownProjectVarIds: ReadonlySet<string>
): ReferencedTaskVariables {
  const raw = extractReferencedVarIdsFromText(movedTaskCorpus, knownProjectVarIds);
  const out = new Set<VarId>();
  for (const id of raw) {
    out.add(id as VarId);
  }
  return out;
}
