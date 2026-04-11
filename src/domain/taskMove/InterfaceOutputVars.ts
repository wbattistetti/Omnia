/**
 * InterfaceOutputVars: ordered VarIds exposed as child→parent outputs (referenced TaskVariables in origin).
 */

import type { InterfaceOutputVars, VarId, VarsReferencedInOrigin } from '../guidModel/types';

export function interfaceOutputVarsFromVarsReferencedInOrigin(
  varsReferencedInOrigin: VarsReferencedInOrigin,
  stableOrder: (ids: Iterable<VarId>) => VarId[]
): InterfaceOutputVars {
  return stableOrder(varsReferencedInOrigin);
}
