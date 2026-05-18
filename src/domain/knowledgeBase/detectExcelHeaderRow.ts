/**
 * Heuristic detection of the true header row in Excel sheets with title/banner rows above columns.
 */

const MAX_SCAN_ROWS = 25;
const MIN_HEADER_COLUMNS = 2;

function nonEmptyCells(row: readonly unknown[]): string[] {
  return row.map((cell) => String(cell ?? '').trim()).filter(Boolean);
}

/** Penalize single-cell title rows, date banners, and favor multi-column short labels. */
export function scoreExcelHeaderCandidate(
  cells: readonly string[],
  nextRowCells: readonly string[] | null
): number {
  const n = cells.length;
  if (n < MIN_HEADER_COLUMNS) return -1;

  let score = n * 12;
  const lengths = cells.map((c) => c.length);
  const maxLen = Math.max(...lengths);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / n;
  const joined = cells.join(' ').toLowerCase();

  if (n === 1 || (maxLen > 90 && n <= 2)) score -= 60;
  if (avgLen > 70) score -= 35;
  if (/ultimo\s+aggiornamento|aggiornamento\s+dati/i.test(joined)) score -= 50;
  if (cells.length === 1 && /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(cells[0] ?? '')) score -= 45;

  if (avgLen <= 35) score += 8;
  if (avgLen <= 22) score += 4;

  if (nextRowCells && nextRowCells.length >= MIN_HEADER_COLUMNS) {
    const overlap = Math.min(nextRowCells.length, n);
    if (overlap >= 2) score += 10;
  }

  return score;
}

function normalizeHeaderToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreKnownHeaderMatch(cells: readonly string[], knownHeaders: readonly string[]): number {
  if (knownHeaders.length < MIN_HEADER_COLUMNS) return 0;
  const known = knownHeaders.map(normalizeHeaderToken).filter(Boolean);
  let hits = 0;
  for (const cell of cells) {
    const c = normalizeHeaderToken(cell);
    if (!c) continue;
    if (known.some((k) => c === k || c.includes(k) || k.includes(c))) hits += 1;
  }
  return hits * 25;
}

export type ExcelHeaderRowHit = {
  rowIndex: number;
  headers: string[];
};

/**
 * Picks the best header row among the first rows of the sheet matrix.
 */
export function findExcelHeaderRowIndex(
  matrix: readonly (readonly unknown[])[],
  knownHeaders?: readonly string[]
): ExcelHeaderRowHit {
  const limit = Math.min(matrix.length, MAX_SCAN_ROWS);
  let bestScore = -1;
  let bestIndex = -1;
  let bestCells: string[] = [];

  for (let i = 0; i < limit; i += 1) {
    const cells = nonEmptyCells(matrix[i] ?? []);
    const next =
      i + 1 < matrix.length ? nonEmptyCells(matrix[i + 1] ?? []) : null;
    let score = scoreExcelHeaderCandidate(cells, next);
    if (score < 0) continue;
    score += scoreKnownHeaderMatch(cells, knownHeaders ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
      bestCells = cells;
    }
  }

  if (bestIndex < 0 || bestCells.length < MIN_HEADER_COLUMNS) {
    throw new Error(
      'Nessuna riga di intestazione con almeno due colonne (controlla righe titolo sopra la tabella).'
    );
  }

  return { rowIndex: bestIndex, headers: bestCells };
}

/**
 * Picks the best header row among the first rows of the sheet matrix.
 */
export function detectExcelHeaderRow(matrix: readonly (readonly unknown[])[]): string[] {
  return findExcelHeaderRowIndex(matrix).headers;
}
