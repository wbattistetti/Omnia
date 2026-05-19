/**
 * Parse TSV/CSV preview text into a grid for aligned table display in the KB reader.
 */

import { findExcelHeaderRowIndex } from './detectExcelHeaderRow';

export type KbTabularGrid = {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
};

export type KbTabularParseResult = {
  /** Lines above the detected header row (titles, dates, etc.). */
  preamble: readonly string[];
  grid: KbTabularGrid;
};

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

function splitWithDelimiter(line: string, delimiter: string): string[] {
  if (delimiter === '\t') return line.split('\t');
  return line.split(delimiter);
}

function splitLineSmart(line: string, preferredDelimiter?: string): string[] {
  const tryDelimiters = preferredDelimiter
    ? [preferredDelimiter, '\t', ';', '|', ',']
    : ['\t', ';', '|', ','];

  let best: string[] = [];
  for (const d of tryDelimiters) {
    const cells = splitWithDelimiter(line, d).map((c) => c.trim());
    if (cells.length > best.length) best = cells;
  }

  if (best.length >= 2) return best;

  const spaced = line
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (spaced.length > best.length) return spaced;

  return best.length > 0 ? best : [line.trim()];
}

function buildMatrix(lines: readonly string[]): string[][] {
  return lines.map((line) => splitLineSmart(line));
}

function padRow(cells: readonly string[], width: number): string[] {
  const row = [...cells];
  while (row.length < width) row.push('');
  return row.slice(0, width);
}

export type ParseKbTabularOptions = {
  maxRows?: number;
  /** Column labels from ingest (improves header detection on banner rows). */
  knownColumnHeaders?: readonly string[];
};

/**
 * Parses tabular preview text, skipping preamble rows above the real header.
 */
/** Prose KB markdown (## sections, lists) — not a delimiter table. */
export function looksLikeProseMarkdown(text: string): boolean {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let headings = 0;
  let listOrBold = 0;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^#{1,6}\s+\S/.test(t)) headings += 1;
    if (/^[-*]\s+\S/.test(t) || /^\*\*[^*]+\*\*/.test(t)) listOrBold += 1;
  }
  return headings >= 1 && headings + listOrBold >= 2;
}

export function parseKbTabularDocument(
  text: string,
  opts: ParseKbTabularOptions = {}
): KbTabularParseResult | null {
  if (looksLikeProseMarkdown(text) && !looksLikeMarkdownPipeTable(text)) {
    return null;
  }
  if (looksLikeMarkdownPipeTable(text)) {
    const md = parseMarkdownPipeTable(text, opts);
    if (md) return md;
  }

  const maxRows = opts.maxRows ?? 500;
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd());

  const nonEmptyIndices = lines
    .map((l, i) => (l.trim().length > 0 ? i : -1))
    .filter((i) => i >= 0);
  if (nonEmptyIndices.length < 2) return null;

  const matrix = buildMatrix(lines);
  let headerIndex: number;
  let headers: string[];

  try {
    const hit = findExcelHeaderRowIndex(matrix, opts.knownColumnHeaders);
    headerIndex = hit.rowIndex;
    headers = hit.headers;
  } catch {
    return parseKbTabularTextLegacy(text, maxRows);
  }

  const headerLine = lines[headerIndex] ?? '';
  const delimiter = detectDelimiter(headerLine);
  const colCount = Math.max(
    headers.length,
    splitWithDelimiter(headerLine, delimiter).length
  );
  if (colCount < 2) return null;

  const normalizedHeaders = padRow(
    splitWithDelimiter(headerLine, delimiter).map((c) => c.trim()),
    colCount
  ).map((h, i) => h || headers[i] || `Col ${i + 1}`);

  const preamble = lines
    .slice(0, headerIndex)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: string[][] = [];
  for (let i = headerIndex + 1; i < lines.length && rows.length < maxRows; i++) {
    const raw = lines[i] ?? '';
    if (!raw.trim()) continue;
    const cells = splitLineSmart(raw, delimiter);
    if (cells.length === 1 && cells[0]!.length > 0 && colCount > 2) {
      const spaced = splitLineSmart(raw);
      if (spaced.length > 1) {
        rows.push(padRow(spaced, colCount));
        continue;
      }
    }
    rows.push(padRow(cells, colCount));
  }

  if (rows.length === 0) return null;

  return {
    preamble,
    grid: { headers: normalizedHeaders, rows },
  };
}

/** First-line delimiter parse (legacy fallback). */
export function parseKbTabularText(text: string, maxRows = 500): KbTabularGrid | null {
  return parseKbTabularDocument(text, { maxRows })?.grid ?? parseKbTabularTextLegacy(text, maxRows);
}

function parseKbTabularTextLegacy(text: string, maxRows: number): KbTabularGrid | null {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;

  const delimiter = detectDelimiter(lines[0]!);
  if ((lines[0]!.match(new RegExp(delimiter === '\t' ? '\\t' : delimiter, 'g')) ?? []).length === 0) {
    return null;
  }

  const headers = splitWithDelimiter(lines[0]!, delimiter).map((c) => c.trim());
  if (headers.length < 2) return null;

  const rows: string[][] = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    rows.push(padRow(splitWithDelimiter(lines[i]!, delimiter).map((c) => c.trim()), headers.length));
  }
  if (rows.length === 0) return null;
  return { headers, rows };
}

export function isKbTabularPreviewName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.endsWith('.xlsx') ||
    lower.endsWith('.csv') ||
    lower.endsWith('.tsv') ||
    lower.endsWith('.md') ||
    lower.endsWith('.markdown')
  );
}

function isMarkdownTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|');
}

function isMarkdownSeparatorRow(line: string): boolean {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return /^[\s\-:|]+$/.test(inner) && inner.includes('-');
}

function parsePipeCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** True if text contains a GitHub-style pipe table. */
export function looksLikeMarkdownPipeTable(text: string): boolean {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let rowCount = 0;
  for (const line of lines) {
    if (isMarkdownTableRow(line)) rowCount += 1;
  }
  return rowCount >= 2;
}

/**
 * Parse Markdown pipe tables (skips |---| separator, optional preamble lines).
 */
export function parseMarkdownPipeTable(
  text: string,
  opts: ParseKbTabularOptions = {}
): KbTabularParseResult | null {
  const maxRows = opts.maxRows ?? 500;
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isMarkdownTableRow(lines[i] ?? '')) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex < 0) return null;

  const headers = parsePipeCells(lines[headerIndex]!).filter(Boolean);
  if (headers.length < 2) return null;

  const preamble = lines
    .slice(0, headerIndex)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: string[][] = [];
  for (let i = headerIndex + 1; i < lines.length && rows.length < maxRows; i++) {
    const raw = lines[i] ?? '';
    if (!raw.trim()) continue;
    if (!isMarkdownTableRow(raw)) {
      if (rows.length > 0) break;
      continue;
    }
    if (isMarkdownSeparatorRow(raw)) continue;
    rows.push(padRow(parsePipeCells(raw), headers.length));
  }

  if (rows.length === 0) return null;
  return { preamble, grid: { headers, rows } };
}
