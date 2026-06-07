/**
 * Lessico slot KB: semantica = valore cella tabella; linguistica = sinonimi per match NL.
 */

import type { KbTabularGrid } from '../parseKbTabularText';
import type { SelectorColumnSpec, SelectorValueLabels } from '../kbSelectorSpec';
import { listAskableSelectorColumns } from '../kbSelectorSpec';
import { distinctColumnValuesForKey } from './kbDialogGrid';
import { getNaturalLabel, humanizeKbCellValue } from './kbDialogValueLabels';

export type KbDialogSlotGroupLexiconEntry = {
  /** Valore canonico tabella (nome gruppo semantico). */
  semantic: string;
  /** Variantii linguistiche incl. il canonico. */
  synonyms: readonly string[];
};

/** columnId → gruppi semantici della colonna. */
export type KbDialogSlotLexicon = Record<string, readonly KbDialogSlotGroupLexiconEntry[]>;

function normalizeLexiconKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/** Costruisce sinonimi iniziali per un concetto (IA potrà arricchire in seguito). */
export function buildSynonymsForSemanticValue(params: {
  columnId: string;
  semantic: string;
  valueLabels: SelectorValueLabels;
}): string[] {
  const { columnId, semantic } = params;
  const seen = new Set<string>();
  const out: string[] = [];

  const add = (s: string) => {
    const t = String(s ?? '').trim();
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  add(semantic);
  add(semantic.replace(/_/g, ' '));
  add(humanizeKbCellValue(semantic));
  add(getNaturalLabel(columnId, semantic, params.valueLabels));

  return out;
}

/** Lessico completo per colonne askable da griglia KB + valueLabels. */
export function buildKbDialogSlotLexicon(params: {
  grid: KbTabularGrid;
  askable: readonly SelectorColumnSpec[];
  valueLabels: SelectorValueLabels;
}): KbDialogSlotLexicon {
  const lexicon: Record<string, KbDialogSlotGroupLexiconEntry[]> = {};

  for (const col of params.askable) {
    const allowed = distinctColumnValuesForKey(params.grid, {}, col.columnId);
    const groups: KbDialogSlotGroupLexiconEntry[] = [];

    for (const semantic of allowed) {
      const synonyms = buildSynonymsForSemanticValue({
        columnId: col.columnId,
        semantic,
        valueLabels: params.valueLabels,
      });
      if (synonyms.length === 0) continue;
      groups.push({ semantic, synonyms });
    }

    if (groups.length > 0) {
      lexicon[col.columnId] = groups;
    }
  }

  return lexicon;
}

/** Lookup sinonimi runtime per (colonna, semantica ammessa). */
export function synonymsForAllowedSemantic(
  lexicon: KbDialogSlotLexicon | undefined,
  columnId: string,
  semantic: string,
  valueLabels: SelectorValueLabels
): readonly string[] {
  const col = lexicon?.[columnId];
  const key = normalizeLexiconKey(semantic);
  const hit = col?.find((g) => normalizeLexiconKey(g.semantic) === key);
  if (hit?.synonyms?.length) return hit.synonyms;
  return buildSynonymsForSemanticValue({ columnId, semantic, valueLabels });
}
