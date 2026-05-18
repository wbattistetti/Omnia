/**
 * Read only the first rows of an .xlsx file (avoids freezing the UI on large sheets).
 */

/** Rows scanned to detect header columns. */
export const KB_XLSX_HEADER_SCAN_ROWS = 60;

/** Rows converted to TSV for repository text preview. */
export const KB_XLSX_PREVIEW_ROWS = 220;

export async function readXlsxWorkbookLimited(
  file: File,
  sheetRows: number
): Promise<import('xlsx').WorkBook> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: 'array', sheetRows: Math.max(1, sheetRows) });
}
