/**
 * Template parametrico complete: interpolazione deterministica sayCore.
 */

import type { KbTabularGrid } from '../parseKbTabularText';
import type { SelectorValueLabels } from '../kbSelectorSpec';
import { DEFAULT_KB_DIALOG_COMPLETE_TEMPLATE } from './kbDialogConstants';
import {
  buildExamSuffix,
  getNaturalLabel,
  isEmptyExamValue,
  rowEtichetta,
} from './kbDialogValueLabels';
import { bindingKeyFromHeader } from './kbDialogGrid';

export type CompletePlaceholderMap = Record<string, string>;

/** Trova colonna esame associato negli header. */
export function detectExamColumnId(headers: readonly string[]): string | undefined {
  for (const h of headers) {
    const id = bindingKeyFromHeader(String(h ?? ''));
    if (id.includes('esame') && !id.includes('obbligatorio')) return id;
  }
  return undefined;
}

/** Costruisce mappa placeholder per binding completo + riga matched. */
export function buildCompletePlaceholders(params: {
  binding: Readonly<Record<string, string>>;
  grid: KbTabularGrid;
  matchedRow?: readonly string[] | null;
  valueLabels: SelectorValueLabels;
  examColumnId?: string;
}): CompletePlaceholderMap {
  const { binding, grid, matchedRow, valueLabels } = params;
  const examColumnId = params.examColumnId ?? detectExamColumnId(grid.headers);
  const map: CompletePlaceholderMap = {};

  for (const [colId, raw] of Object.entries(binding)) {
    if (!raw) continue;
    map[`${colId}_nat`] = getNaturalLabel(colId, raw, valueLabels);
  }

  map.tipo_visita_nat = map.tipo_visita_nat ?? getNaturalLabel('tipo_visita', binding.tipo_visita ?? '', valueLabels);
  map.specialita_nat = map.specialita_nat ?? getNaturalLabel('specialita', binding.specialita ?? binding.specialty ?? '', valueLabels);
  map.esame_suffix = buildExamSuffix(examColumnId, binding, valueLabels);

  if (matchedRow) {
    const et = rowEtichetta(grid, matchedRow);
    if (et) map.etichetta_riga = et;
  }

  return map;
}

/** Sostituisce {key} nel template; lascia token non risolti per gap analysis. */
export function interpolateTemplate(
  template: string,
  placeholders: Readonly<Record<string, string>>
): string {
  let out = template;
  for (const [key, val] of Object.entries(placeholders)) {
    out = out.split(`{${key}}`).join(val ?? '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function interpolateCompleteTemplate(params: {
  template?: string;
  binding: Readonly<Record<string, string>>;
  grid: KbTabularGrid;
  matchedRow?: readonly string[] | null;
  valueLabels: SelectorValueLabels;
}): { sayCore: string; placeholders: CompletePlaceholderMap; unresolved: string[] } {
  const template = (params.template ?? DEFAULT_KB_DIALOG_COMPLETE_TEMPLATE).trim();
  const placeholders = buildCompletePlaceholders({
    binding: params.binding,
    grid: params.grid,
    matchedRow: params.matchedRow,
    valueLabels: params.valueLabels,
  });
  const sayCore = interpolateTemplate(template, placeholders);
  const unresolved = [...sayCore.matchAll(/\{([a-z0-9_]+)\}/gi)].map((m) => m[1] ?? '');
  return { sayCore, placeholders, unresolved };
}

/** Euristica: frase innaturale post-interpolazione. */
export function looksUnnaturalCompleteSay(say: string): boolean {
  if (!say.trim()) return true;
  if (/\{[a-z0-9_]+\}/i.test(say)) return true;
  if (/\bvisita\s+(prima\s+visita|visita\s+di\s+controllo)\b/i.test(say)) return true;
  if (/\s{2,}/.test(say)) return true;
  return false;
}

export function bindingHasEmptyExam(
  binding: Readonly<Record<string, string>>,
  examColumnId?: string
): boolean {
  if (!examColumnId) return true;
  return isEmptyExamValue(binding[examColumnId] ?? '');
}
