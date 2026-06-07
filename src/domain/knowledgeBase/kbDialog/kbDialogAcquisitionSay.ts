/**
 * Interpolazione say acquisition UC: {col_nat}, [col] da binding, [semantic] da allowedValues.
 */

import { normalizeKbCellValue } from './kbDialogGrid';
import { getNaturalLabel } from './kbDialogValueLabels';
import type { SelectorValueLabels } from '../kbSelectorSpec';

function normalizeToken(raw: string): string {
  return normalizeKbCellValue(raw).toLowerCase().replace(/\s+/g, '_');
}

function buildAcquisitionPlaceholders(
  binding: Readonly<Record<string, string>>,
  valueLabels: SelectorValueLabels
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [colId, raw] of Object.entries(binding)) {
    if (!normalizeKbCellValue(raw)) continue;
    map[`${colId}_nat`] = getNaturalLabel(colId, raw, valueLabels);
    map[colId] = raw;
  }
  return map;
}

function interpolateCurlies(template: string, placeholders: Readonly<Record<string, string>>): string {
  let out = template;
  for (const [key, val] of Object.entries(placeholders)) {
    out = out.split(`{${key}}`).join(val ?? '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Interpola template acquisition con binding corrente e valori ammessi. */
export function interpolateAcquisitionSay(params: {
  say: string;
  binding: Readonly<Record<string, string>>;
  valueLabels: SelectorValueLabels;
  allowedValues?: readonly string[];
  selectorColumnId?: string;
}): string {
  const raw = String(params.say ?? '').trim();
  if (!raw) return raw;

  const withCurlies = interpolateCurlies(raw, buildAcquisitionPlaceholders(params.binding, params.valueLabels));

  return withCurlies.replace(/\[([a-z0-9_]+)\]/gi, (full, token: string) => {
    const key = String(token ?? '').trim();
    if (!key) return full;

    if (normalizeKbCellValue(params.binding[key] ?? '')) {
      return getNaturalLabel(key, params.binding[key]!, params.valueLabels);
    }

    for (const av of params.allowedValues ?? []) {
      const semantic = String(av ?? '').trim();
      if (!semantic) continue;
      if (normalizeToken(semantic) === normalizeToken(key)) {
        const col = params.selectorColumnId || key;
        return getNaturalLabel(col, semantic, params.valueLabels);
      }
      const nat = getNaturalLabel(params.selectorColumnId || key, semantic, params.valueLabels);
      if (normalizeToken(nat) === normalizeToken(key)) return nat;
    }

    for (const [colId, val] of Object.entries(params.binding)) {
      if (!normalizeKbCellValue(val)) continue;
      const nat = getNaturalLabel(colId, val, params.valueLabels);
      if (normalizeToken(nat) === normalizeToken(key)) return nat;
    }

    return full;
  });
}
