/**
 * Parses KB documents (.txt / .csv tabular, .xlsx) and extracts column → variable mappings.
 */

import {
  columnNameToVariable,
  normalizeKbHeaderKey,
  toKbPlaceholder,
} from './kbDocumentColumnMap';
import { detectExcelHeaderRow } from '@domain/knowledgeBase/detectExcelHeaderRow';
import { normalizeKbDocumentText } from '@domain/knowledgeBase/kbDocumentTextNormalize';
import { parseKbTabularDocument } from '@domain/knowledgeBase/parseKbTabularText';
import {
  KB_XLSX_HEADER_SCAN_ROWS,
  readXlsxWorkbookLimited,
} from '@domain/knowledgeBase/xlsxLimitedRead';

export type KbExtractedVariable = {
  sourceColumn: string;
  internalName: string;
  placeholder: string;
};

export type KbParseResult = {
  format: 'txt' | 'csv' | 'xlsx';
  variables: KbExtractedVariable[];
  /** Maps variable id → original column header (same labels as in the file). */
  variableDictionary: Record<string, string>;
};

export type KbParseError = {
  format: 'txt' | 'csv' | 'xlsx' | 'unknown';
  message: string;
};

function dedupeVariables(columns: readonly string[]): KbExtractedVariable[] {
  const out: KbExtractedVariable[] = [];
  const usedInternal = new Set<string>();
  for (const sourceColumn of columns) {
    const trimmed = sourceColumn.trim();
    if (!trimmed) continue;
    let internalName = columnNameToVariable(trimmed);
    if (usedInternal.has(internalName)) {
      const suffix = normalizeKbHeaderKey(trimmed).replace(/\s+/g, '_');
      internalName = `${internalName}_${suffix}`.replace(/_+/g, '_');
    }
    usedInternal.add(internalName);
    out.push({
      sourceColumn: trimmed,
      internalName,
      placeholder: toKbPlaceholder(internalName),
    });
  }
  return out;
}

function buildDictionary(variables: readonly KbExtractedVariable[]): Record<string, string> {
  const dict: Record<string, string> = {};
  for (const v of variables) {
    dict[v.internalName] = v.sourceColumn;
  }
  return dict;
}

function detectDelimiter(line: string): string {
  const counts: [string, number][] = [
    ['\t', (line.match(/\t/g) ?? []).length],
    [';', (line.match(/;/g) ?? []).length],
    ['|', (line.match(/\|/g) ?? []).length],
    [',', (line.match(/,/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  const best = counts[0];
  return best && best[1] > 0 ? best[0] : '\t';
}

function splitHeaderLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') return line.split('\t');
  return line.split(delimiter).map((c) => c.trim());
}

function extractColumnsFromFirstLine(firstLine: string): string[] {
  const delimiter = detectDelimiter(firstLine);
  let columns = splitHeaderLine(firstLine, delimiter).map((c) => c.trim()).filter(Boolean);

  if (columns.length >= 2) return columns;

  for (const alt of ['\t', ';', '|', ',']) {
    if (alt === delimiter) continue;
    const split = splitHeaderLine(firstLine, alt).map((c) => c.trim()).filter(Boolean);
    if (split.length > columns.length) columns = split;
  }

  return columns;
}

/**
 * First non-empty line = header row; each cell is one variable (name from column only).
 */
export function parseKbTextContent(
  text: string,
  opts?: { format?: 'txt' | 'csv' }
): KbParseResult {
  const normalized = normalizeKbDocumentText(text);
  const firstLine = normalized.split('\n').find((l) => l.trim().length > 0) ?? '';
  if (!firstLine.trim()) {
    throw new Error('File di testo vuoto o senza intestazione.');
  }

  const columns = extractColumnsFromFirstLine(firstLine);

  if (columns.length === 0) {
    throw new Error('Nessuna colonna nella prima riga del documento.');
  }

  const variables = dedupeVariables(columns);
  return {
    format: opts?.format ?? 'txt',
    variables,
    variableDictionary: buildDictionary(variables),
  };
}

/** Comma/semicolon-separated tabular file (skips banner rows above column headers). */
export function parseKbCsvContent(text: string): KbParseResult {
  const tabular = parseKbTabularDocument(normalizeKbDocumentText(text));
  const headers = (tabular?.grid.headers ?? []).map((h) => h.trim()).filter(Boolean);
  if (headers.length >= 2) {
    const variables = dedupeVariables(headers);
    return {
      format: 'csv',
      variables,
      variableDictionary: buildDictionary(variables),
    };
  }
  return parseKbTextContent(text, { format: 'csv' });
}

async function readXlsxColumnHeaders(file: File): Promise<string[]> {
  const XLSX = await import('xlsx');
  const workbook = await readXlsxWorkbookLimited(file, KB_XLSX_HEADER_SCAN_ROWS);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Il file Excel non contiene fogli.');
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as string[][];
  if (matrix.length === 0) {
    throw new Error('Il foglio Excel è vuoto.');
  }
  return detectExcelHeaderRow(matrix);
}

export async function parseKbXlsxFile(file: File): Promise<KbParseResult> {
  const columns = await readXlsxColumnHeaders(file);
  if (columns.length === 0) {
    throw new Error('Nessuna colonna trovata nel file Excel.');
  }
  const variables = dedupeVariables(columns);
  return {
    format: 'xlsx',
    variables,
    variableDictionary: buildDictionary(variables),
  };
}

export function isKbTxtFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.txt') || file.type === 'text/plain';
}

export function isKbXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.xlsx') ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

export function isKbCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.csv') ||
    name.endsWith('.tsv') ||
    file.type === 'text/csv' ||
    file.type === 'text/tab-separated-values'
  );
}

export async function parseKbFile(file: File): Promise<KbParseResult> {
  if (isKbXlsxFile(file)) return parseKbXlsxFile(file);
  if (isKbCsvFile(file)) {
    const text = await file.text();
    return parseKbCsvContent(text);
  }
  if (isKbTxtFile(file)) {
    const text = await file.text();
    return parseKbTextContent(text);
  }
  throw new Error('Formato non supportato. Usa file .txt, .csv (tabellare) o .xlsx.');
}
