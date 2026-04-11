/**
 * Canonical translation keys for interface rows: `interface:<guid>` (see utils/translationKeys).
 */

import { makeTranslationKey } from '../../utils/translationKeys';
import type { VarId } from './types';

/** 1:1 mapping VarId → TranslationKey for variable-linked interface labels. */
export function labelKey(varId: VarId): string {
  return makeTranslationKey('interface', String(varId));
}
