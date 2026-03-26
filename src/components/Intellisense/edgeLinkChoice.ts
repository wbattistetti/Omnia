/**
 * Scelta utente alla chiusura del picker sul nuovo link: immutabile e indipendente da IntellisenseContext
 * (nessuna dipendenza da state.query dopo close).
 */

import type { IntellisenseItem } from '../../types/intellisense';

export type EdgeLinkChoice =
  | { kind: 'catalog'; item: IntellisenseItem }
  | { kind: 'freeText'; text: string }
  | { kind: 'else' }
  | { kind: 'unlinked' };

/** Da item menu (inclusi sentinel __else__ / __unlinked__). */
export function edgeLinkChoiceFromIntellisenseItem(item: IntellisenseItem): EdgeLinkChoice {
  if (item.id === '__else__') return { kind: 'else' };
  if (item.id === '__unlinked__') return { kind: 'unlinked' };
  return { kind: 'catalog', item };
}

/** Da input: vuoto → unlinked, altrimenti testo libero (nuova condizione o match progetto). */
export function edgeLinkChoiceFromInputText(raw: string): EdgeLinkChoice {
  const t = raw.trim();
  if (t.length === 0) return { kind: 'unlinked' };
  return { kind: 'freeText', text: t };
}
