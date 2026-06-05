/**
 * Serializza griglia tabellare KB in markdown pipe table (sezione Dati normalizzati).
 */

import type { KbTabularGrid } from './parseKbTabularText';

const DEFAULT_SECTION = '## Dati normalizzati';

function padRow(row: readonly string[], width: number): string[] {
  const out = [...row];
  while (out.length < width) out.push('');
  return out.slice(0, width);
}

/** Escape pipe characters inside a markdown table cell. */
export function escapeMarkdownPipeCell(value: string): string {
  return String(value ?? '').replace(/\|/g, '\\|').trim();
}

function formatPipeRow(cells: readonly string[]): string {
  return `| ${cells.map(escapeMarkdownPipeCell).join(' | ')} |`;
}

export type SerializeMarkdownPipeTableOptions = {
  preamble?: readonly string[];
  /** Usato se preamble assente (default «## Dati normalizzati»). */
  sectionTitle?: string;
};

/** Converte griglia → markdown pipe table con preambolo opzionale. */
export function serializeMarkdownPipeTable(
  grid: KbTabularGrid,
  opts: SerializeMarkdownPipeTableOptions = {}
): string {
  const headers = grid.headers.map((h) => h.trim()).filter((h, i, arr) => h.length > 0 || arr.length > 1);
  if (headers.length < 1) {
    throw new Error('serializeMarkdownPipeTable: almeno una colonna richiesta');
  }

  const preamble =
    opts.preamble && opts.preamble.length > 0
      ? [...opts.preamble]
      : [opts.sectionTitle?.trim() || DEFAULT_SECTION];

  const separator = headers.map(() => '---');
  const dataRows = grid.rows.map((row) => formatPipeRow(padRow(row, headers.length)));

  return [...preamble, '', formatPipeRow(headers), formatPipeRow(separator), ...dataRows].join('\n');
}

/** Roundtrip helper: parse result → markdown (preserva preamble se presente). */
export function serializeParsedKbTabular(
  parsed: { preamble: readonly string[]; grid: KbTabularGrid },
  sectionTitle?: string
): string {
  return serializeMarkdownPipeTable(parsed.grid, {
    preamble: parsed.preamble.length > 0 ? parsed.preamble : undefined,
    sectionTitle,
  });
}
