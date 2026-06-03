/**
 * Criteri di validazione totale per Slot Mapping (design-time).
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  getSlotDefinition,
  listRegisteredSlotIds,
  slotBindingStatus,
} from '@domain/useCaseBundle/dynamicSlotRegistry';
import {
  isUnclassifiedSlotId,
  type ProjectSlotLexicon,
} from '@domain/useCaseBundle/projectSlotLexicon';
import { countLexiconConflicts } from './useCaseBundleUiHelpers';
import { countStaleCompiledPhrases } from './useCaseBundleUiHelpers';

export type SlotMappingValidationStatus = 'valid' | 'invalid';

export interface SlotMappingValidationResult {
  status: SlotMappingValidationStatus;
  /** Motivi umani quando `invalid` (vuoto se valid). */
  reasons: string[];
}

/**
 * Validazione totale: tutte le voci approvate, nessun `undefined` generico, zero conflitti,
 * nessuna frase compilata stale nel catalogo.
 */
export function computeSlotMappingValidation(
  lexicon: ProjectSlotLexicon,
  useCases: readonly AIAgentUseCase[]
): SlotMappingValidationResult {
  const reasons: string[] = [];
  const entries = lexicon.entries;

  if (entries.length === 0) {
    reasons.push('Nessuno slot nel mapping');
  }

  const unapproved = entries.filter((e) => !e.approved && !e.conflictWith);
  if (unapproved.length > 0) {
    reasons.push(`${unapproved.length} slot non confermati`);
  }

  const genericSlot = entries.filter((e) => isUnclassifiedSlotId(e.slot_id));
  if (genericSlot.length > 0) {
    reasons.push(`${genericSlot.length} categoria non classificata`);
  }

  const conflicts = countLexiconConflicts(lexicon);
  if (conflicts > 0) {
    reasons.push(`${conflicts} conflitto/i`);
  }

  const stale = countStaleCompiledPhrases(useCases);
  if (stale > 0) {
    reasons.push(`${stale} frase/i da allineare`);
  }

  let unboundSlots = 0;
  for (const slotId of listRegisteredSlotIds(lexicon)) {
    const def = getSlotDefinition(lexicon, slotId);
    if (slotBindingStatus(def) !== 'ok') unboundSlots += 1;
  }
  if (unboundSlots > 0) {
    reasons.push(`${unboundSlots} slot senza binding nel dizionario`);
  }

  if (reasons.length === 0) {
    return { status: 'valid', reasons: [] };
  }
  return { status: 'invalid', reasons };
}
