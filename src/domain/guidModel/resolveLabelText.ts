/**
 * Resolves display text for a VarId from a translations map (`var:<guid>`); missing → GUID.
 */

import { getVariableLabel } from '../../utils/getVariableLabel';
import type { VarId } from './types';

export function resolveLabelText(varId: VarId, projectTranslations: Record<string, string> | undefined): string {
  return getVariableLabel(String(varId), projectTranslations);
}
