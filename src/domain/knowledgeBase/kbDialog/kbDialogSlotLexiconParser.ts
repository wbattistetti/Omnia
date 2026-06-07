/**
 * Parser deterministico: utterance → updates slot (semantica + linguistica matched).
 */

import type { KbTabularGrid } from '../parseKbTabularText';
import type { KbDocumentSelectorSpec, SelectorColumnSpec, SelectorValueLabels } from '../kbSelectorSpec';
import { listAskableSelectorColumns } from '../kbSelectorSpec';
import { distinctColumnValuesForKey, normalizeKbCellValue } from './kbDialogGrid';
import type { KbDialogSlotLexicon } from './kbDialogSlotLexicon';
import { synonymsForAllowedSemantic } from './kbDialogSlotLexicon';

export type SlotLexiconMatchDetail = {
  columnId: string;
  semantic: string;
  matched: string;
};

export type SlotLexiconParseResult = {
  updates: Record<string, string>;
  matches: SlotLexiconMatchDetail[];
};

function normalizeForMatch(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True se `phrase` compare in `utterance` come token/frase delimitata. */
export function utteranceContainsPhrase(utterance: string, phrase: string): boolean {
  const u = normalizeForMatch(utterance);
  const p = normalizeForMatch(phrase);
  if (!u || !p) return false;
  if (p.includes(' ')) {
    return u.includes(p);
  }
  const re = new RegExp(`(?:^|\\s)${escapeRegex(p)}(?:\\s|$)`, 'i');
  return re.test(` ${u} `);
}

function listPendingColumns(
  askable: readonly SelectorColumnSpec[],
  binding: Readonly<Record<string, string>>
): SelectorColumnSpec[] {
  return askable.filter((col) => !normalizeKbCellValue(binding[col.columnId] ?? ''));
}

/**
 * Estrae slot da frase naturale usando lessico gruppo/sinonimi (multi-colonna).
 */
export function parseUtteranceWithSlotLexicon(params: {
  utterance: string;
  grid: KbTabularGrid;
  selectorSpec: KbDocumentSelectorSpec;
  binding: Readonly<Record<string, string>>;
  slotLexicon?: KbDialogSlotLexicon;
  valueLabels?: SelectorValueLabels;
}): SlotLexiconParseResult {
  const text = String(params.utterance ?? '').trim();
  const updates: Record<string, string> = {};
  const matches: SlotLexiconMatchDetail[] = [];
  if (!text) return { updates, matches };

  const askable = listAskableSelectorColumns(params.selectorSpec);
  const valueLabels = params.valueLabels ?? {};
  const pending = listPendingColumns(askable, params.binding);

  for (const col of pending) {
    const colId = col.columnId;
    const allowed = distinctColumnValuesForKey(params.grid, params.binding, colId);
    if (allowed.length === 0) continue;

    let best: SlotLexiconMatchDetail | null = null;
    let bestLen = 0;

    for (const semantic of allowed) {
      const synonyms = synonymsForAllowedSemantic(
        params.slotLexicon,
        colId,
        semantic,
        valueLabels
      );
      const sorted = [...synonyms].sort(
        (a, b) => normalizeForMatch(b).length - normalizeForMatch(a).length
      );
      for (const syn of sorted) {
        if (!utteranceContainsPhrase(text, syn)) continue;
        const len = normalizeForMatch(syn).length;
        if (len > bestLen) {
          bestLen = len;
          best = { columnId: colId, semantic, matched: syn };
        }
      }
    }

    if (best) {
      updates[colId] = best.semantic;
      matches.push(best);
    }
  }

  return { updates, matches };
}
