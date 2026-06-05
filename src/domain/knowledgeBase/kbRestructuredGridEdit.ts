/**
 * Operazioni di editing sulla griglia tabella riformattata KB.
 */

import type { KbTabularGrid } from './parseKbTabularText';

export type MutableKbTabularGrid = {
  headers: string[];
  rows: string[][];
};

export function cloneKbTabularGrid(grid: KbTabularGrid): MutableKbTabularGrid {
  return {
    headers: [...grid.headers],
    rows: grid.rows.map((row) => [...row]),
  };
}

export function toKbTabularGrid(mutable: MutableKbTabularGrid): KbTabularGrid {
  return { headers: [...mutable.headers], rows: mutable.rows.map((row) => [...row]) };
}

/** Normalizza valore cella per confronto (trim; trattino = vuoto). */
export function normalizeGridCellValue(value: string): string {
  const v = String(value ?? '').trim();
  if (v === '—' || v === '-') return '';
  return v;
}

export function gridCellValuesEqual(a: string, b: string): boolean {
  return normalizeGridCellValue(a) === normalizeGridCellValue(b);
}

function padRow(row: string[], width: number): string[] {
  const out = [...row];
  while (out.length < width) out.push('');
  return out.slice(0, width);
}

function assertColumnIndex(grid: MutableKbTabularGrid, colIndex: number): void {
  if (colIndex < 0 || colIndex >= grid.headers.length) {
    throw new Error(`Indice colonna non valido: ${colIndex}`);
  }
}

/** Sposta colonna da `fromIndex` a `toIndex`. */
export function reorderGridColumn(
  grid: MutableKbTabularGrid,
  fromIndex: number,
  toIndex: number
): MutableKbTabularGrid {
  if (fromIndex === toIndex) return grid;
  assertColumnIndex(grid, fromIndex);
  assertColumnIndex(grid, toIndex);

  const headers = [...grid.headers];
  const [moved] = headers.splice(fromIndex, 1);
  headers.splice(toIndex, 0, moved!);

  const rows = grid.rows.map((row) => {
    const cells = [...row];
    const [movedCell] = cells.splice(fromIndex, 1);
    cells.splice(toIndex, 0, movedCell ?? '');
    return padRow(cells, headers.length);
  });

  return { headers, rows };
}

/** Rinomina header colonna (snake_case consigliato ma non imposto). */
export function renameGridColumn(
  grid: MutableKbTabularGrid,
  colIndex: number,
  newHeader: string
): MutableKbTabularGrid {
  assertColumnIndex(grid, colIndex);
  const header = newHeader.trim();
  if (!header) throw new Error('Nome colonna obbligatorio');
  const headers = [...grid.headers];
  headers[colIndex] = header;
  return { ...grid, headers };
}

/** Elimina colonna (minimo 1 colonna restante). */
export function deleteGridColumn(
  grid: MutableKbTabularGrid,
  colIndex: number
): MutableKbTabularGrid {
  assertColumnIndex(grid, colIndex);
  if (grid.headers.length <= 1) {
    throw new Error('Impossibile eliminare l’ultima colonna');
  }
  const headers = grid.headers.filter((_, i) => i !== colIndex);
  const rows = grid.rows.map((row) => padRow(row.filter((_, i) => i !== colIndex), headers.length));
  return { headers, rows };
}

/** Aggiunge colonna in coda con valore default per ogni riga. */
export function addGridColumn(
  grid: MutableKbTabularGrid,
  header: string,
  defaultCellValue = ''
): MutableKbTabularGrid {
  const name = header.trim();
  if (!name) throw new Error('Nome colonna obbligatorio');
  if (grid.headers.some((h) => h.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`Colonna «${name}» già presente`);
  }
  return insertGridColumnAfter(grid, grid.headers.length - 1, name, defaultCellValue);
}

/** Header temporaneo per colonna appena inserita (prima del rename). */
export function isPendingColumnHeader(header: string): boolean {
  return /^__pending_\d+__$/.test(header.trim());
}

/** Genera header placeholder univoco per nuova colonna in editing. */
export function createPendingColumnHeader(existingHeaders: readonly string[]): string {
  let n = 1;
  while (existingHeaders.some((h) => h.trim() === `__pending_${n}__`)) n += 1;
  return `__pending_${n}__`;
}

/** Inserisce colonna subito a destra di `afterIndex`. */
export function insertGridColumnAfter(
  grid: MutableKbTabularGrid,
  afterIndex: number,
  header: string,
  defaultCellValue = ''
): MutableKbTabularGrid {
  if (afterIndex < -1 || afterIndex >= grid.headers.length) {
    throw new Error(`Indice colonna non valido: ${afterIndex}`);
  }
  const name = header.trim();
  if (!name) throw new Error('Nome colonna obbligatorio');
  if (grid.headers.some((h) => h.trim().toLowerCase() === name.toLowerCase())) {
    throw new Error(`Colonna «${name}» già presente`);
  }
  const insertAt = afterIndex + 1;
  const headers = [...grid.headers];
  headers.splice(insertAt, 0, name);
  const rows = grid.rows.map((row) => {
    const cells = padRow(row, grid.headers.length);
    cells.splice(insertAt, 0, defaultCellValue);
    return padRow(cells, headers.length);
  });
  return { headers, rows };
}

export type ReplaceColumnValuesResult = {
  grid: MutableKbTabularGrid;
  replacedCount: number;
};

/**
 * Sostituisce in colonna tutte le celle con `oldValue` (match normalizzato) con `newValue`.
 */
export function replaceColumnValues(
  grid: MutableKbTabularGrid,
  colIndex: number,
  oldValue: string,
  newValue: string
): ReplaceColumnValuesResult {
  assertColumnIndex(grid, colIndex);
  const normalizedOld = normalizeGridCellValue(oldValue);
  const nextValue = String(newValue ?? '').trim();
  if (gridCellValuesEqual(oldValue, newValue)) {
    return { grid, replacedCount: 0 };
  }

  let replacedCount = 0;
  const rows = grid.rows.map((row) => {
    const cells = [...padRow(row, grid.headers.length)];
    const current = cells[colIndex] ?? '';
    if (gridCellValuesEqual(current, oldValue) || normalizeGridCellValue(current) === normalizedOld) {
      cells[colIndex] = nextValue;
      replacedCount += 1;
    }
    return cells;
  });

  return { grid: { ...grid, rows }, replacedCount };
}

/** Aggiorna solo la cella indicata (nessuna propagazione in colonna). */
export function setSingleGridCellValue(
  grid: MutableKbTabularGrid,
  rowIndex: number,
  colIndex: number,
  newValue: string
): MutableKbTabularGrid {
  if (rowIndex < 0 || rowIndex >= grid.rows.length) {
    throw new Error(`Indice riga non valido: ${rowIndex}`);
  }
  assertColumnIndex(grid, colIndex);
  const nextValue = String(newValue ?? '').trim();
  const rows = grid.rows.map((row, ri) => {
    if (ri !== rowIndex) return padRow(row, grid.headers.length);
    const cells = [...padRow(row, grid.headers.length)];
    cells[colIndex] = nextValue;
    return cells;
  });
  return { ...grid, rows };
}

/** Propaga in colonna: tutte le celle con `previousValue` (identità pre-edit) → `newValue`. */
export function commitGridCellEdit(
  grid: MutableKbTabularGrid,
  rowIndex: number,
  colIndex: number,
  previousValue: string,
  newValue: string
): ReplaceColumnValuesResult {
  if (rowIndex < 0 || rowIndex >= grid.rows.length) {
    throw new Error(`Indice riga non valido: ${rowIndex}`);
  }
  assertColumnIndex(grid, colIndex);
  return replaceColumnValues(grid, colIndex, previousValue, newValue);
}

/** Rinomina chiave istruzioni colonna se header cambia. */
export function remapColumnInstructions(
  instructions: Readonly<Record<string, string>>,
  oldHeader: string,
  newHeader: string
): Record<string, string> {
  const oldKey = oldHeader.trim();
  const newKey = newHeader.trim();
  if (!oldKey || oldKey === newKey) return { ...instructions };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(instructions)) {
    if (key === oldKey) out[newKey] = value;
    else out[key] = value;
  }
  return out;
}

/** Rimuove istruzione colonna eliminata. */
export function removeColumnInstruction(
  instructions: Readonly<Record<string, string>>,
  header: string
): Record<string, string> {
  const key = header.trim();
  const out = { ...instructions };
  delete out[key];
  return out;
}
