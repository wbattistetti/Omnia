/**
 * Filtro tabella KB per binding parziale (dialog step runtime / generazione UC).
 */

import type { KbTabularGrid } from '../parseKbTabularText';
import { isEmptySelectorCellValue, slugifySelectorColumnId } from '../kbSelectorSpec';

export function normalizeKbCellValue(value: string): string {
  if (isEmptySelectorCellValue(value)) return '';
  return String(value ?? '').trim();
}

export function headerIndexBySlug(headers: readonly string[], columnKey: string): number {
  const target = slugifySelectorColumnId(columnKey);
  return headers.findIndex((h) => slugifySelectorColumnId(String(h ?? '')) === target);
}

export function filterRowsByBinding(
  grid: KbTabularGrid,
  binding: Readonly<Record<string, string>>
): string[][] {
  const { headers, rows } = grid;
  return rows.filter((row) => {
    for (const [key, rawVal] of Object.entries(binding)) {
      const want = normalizeKbCellValue(rawVal);
      if (!want) continue;
      const idx = headerIndexBySlug(headers, key);
      if (idx < 0) continue;
      const cell = normalizeKbCellValue(String(row[idx] ?? ''));
      if (cell.toLowerCase() !== want.toLowerCase()) return false;
    }
    return true;
  });
}

export function distinctColumnValuesForKey(
  grid: KbTabularGrid,
  binding: Readonly<Record<string, string>>,
  columnKey: string
): string[] {
  const idx = headerIndexBySlug(grid.headers, columnKey);
  if (idx < 0) return [];
  const filtered = filterRowsByBinding(grid, binding);
  const seen = new Set<string>();
  for (const row of filtered) {
    const v = normalizeKbCellValue(String(row[idx] ?? ''));
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'it'));
}

export function bindingKeyFromHeader(header: string): string {
  return slugifySelectorColumnId(header);
}
