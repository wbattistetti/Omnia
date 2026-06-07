/**
 * Lexicon label naturali per valori colonna KB (interpolazione complete / acquisition).
 */

import type { KbTabularGrid } from '../parseKbTabularText';
import type { SelectorValueLabels } from '../kbSelectorSpec';
import { slugifySelectorColumnId } from '../kbSelectorSpec';
import { headerIndexBySlug, normalizeKbCellValue } from './kbDialogGrid';

const EXAM_EMPTY = new Set(['', 'nessuno', 'none', 'no', '-']);

/** True se valore esame = assente / non applicabile. */
export function isEmptyExamValue(value: string): boolean {
  const v = normalizeKbCellValue(value).toLowerCase().replace(/\s+/g, '_');
  return EXAM_EMPTY.has(v) || v.startsWith('non_');
}

/** Heuristic: snake_case cell → frase naturale. */
export function humanizeKbCellValue(raw: string): string {
  const v = normalizeKbCellValue(raw);
  if (!v) return '';
  const norm = v.toLowerCase().replace(/\s+/g, '_');
  const map: Record<string, string> = {
    prima_visita: 'prima visita',
    controllo: 'visita di controllo',
    cardiologia: 'cardiologica',
    radiologia: 'radiologica',
    pneumologia: 'pneumologica',
    ginecologia: 'ginecologica',
    ecg: 'ECG',
    ecografia: 'ecografia',
    nessuno: '',
  };
  if (map[norm] !== undefined) return map[norm];
  return v.replace(/_/g, ' ').trim();
}

/** Label naturale per (colonna, valore canonico). */
export function getNaturalLabel(
  columnId: string,
  rawValue: string,
  labels: SelectorValueLabels
): string {
  const col = labels[columnId];
  const key = normalizeKbCellValue(rawValue).toLowerCase();
  if (col && col[key]) return col[key];
  return humanizeKbCellValue(rawValue);
}

/** Inferisce lexicon da griglia + colonna etichetta riga se presente. */
export function inferValueLabelsFromGrid(grid: KbTabularGrid): SelectorValueLabels {
  const out: SelectorValueLabels = {};
  for (let i = 0; i < grid.headers.length; i += 1) {
    const header = String(grid.headers[i] ?? '').trim();
    if (!header) continue;
    const columnId = slugifySelectorColumnId(header);
    const colLabels: Record<string, string> = {};
    for (const row of grid.rows) {
      const raw = normalizeKbCellValue(String(row[i] ?? ''));
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!colLabels[key]) {
        colLabels[key] = humanizeKbCellValue(raw);
      }
    }
    if (Object.keys(colLabels).length > 0) {
      out[columnId] = colLabels;
    }
  }
  return out;
}

export function mergeValueLabels(
  base: SelectorValueLabels,
  patch: SelectorValueLabels
): SelectorValueLabels {
  const out: SelectorValueLabels = { ...base };
  for (const [colId, vals] of Object.entries(patch)) {
    out[colId] = { ...(out[colId] ?? {}), ...vals };
  }
  return out;
}

/** Suffisso esame per template complete. */
export function buildExamSuffix(
  examColumnId: string | undefined,
  binding: Readonly<Record<string, string>>,
  labels: SelectorValueLabels
): string {
  if (!examColumnId) return '';
  const raw = binding[examColumnId] ?? '';
  if (isEmptyExamValue(raw)) return '';
  const nat = getNaturalLabel(examColumnId, raw, labels);
  if (!nat) return '';
  return nat.toUpperCase() === nat && nat.length <= 5 ? ` con ${nat}` : ` con ${nat}`;
}

/** Etichetta riga da colonna etichetta se presente. */
export function rowEtichetta(grid: KbTabularGrid, row: readonly string[]): string {
  const idx = headerIndexBySlug(grid.headers, 'etichetta');
  if (idx < 0) return '';
  return normalizeKbCellValue(String(row[idx] ?? ''));
}
