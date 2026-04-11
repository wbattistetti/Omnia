/**
 * InterfaceInputVars: ordered VarIds for parent→child inputs (external dependencies of the moved task).
 */

import type { ChildRequiredVariables, InterfaceInputVars, VarId } from '../guidModel/types';

export function interfaceInputVarsFromChildRequiredVariables(
  childRequiredVariables: ChildRequiredVariables,
  stableOrder: (ids: Iterable<VarId>) => VarId[]
): InterfaceInputVars {
  return stableOrder(childRequiredVariables);
}
