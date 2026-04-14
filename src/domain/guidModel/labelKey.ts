/**
 * Canonical translation key for variable-linked Interface rows and canvas `var:` labels: `var:<guid>`.
 */

import { makeTranslationKey } from '../../utils/translationKeys';
import type { VarId } from './types';

/** 1:1 mapping VarId → `var:<guid>` (same key as flow canvas variable translations). */
export function labelKey(varId: VarId): string {
  return makeTranslationKey('var', String(varId));
}
