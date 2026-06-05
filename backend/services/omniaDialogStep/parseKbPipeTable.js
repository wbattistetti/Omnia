/**
 * Parse minimale tabella markdown pipe (## Dati normalizzati) per runtime dialogo KB.
 */

'use strict';

function trimCell(v) {
  return String(v ?? '').trim().replace(/\\\|/g, '|');
}

function isSeparatorRow(line) {
  const t = String(line ?? '').trim();
  if (!t.startsWith('|')) return false;
  return /^\|[\s\-:|]+\|$/.test(t);
}

/**
 * @param {string} markdown
 * @returns {{ preamble: string[], headers: string[], rows: string[][] } | null}
 */
function parseKbPipeTable(markdown) {
  const lines = String(markdown ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let tableStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('|') && !isSeparatorRow(lines[i])) {
      tableStart = i;
      break;
    }
  }
  if (tableStart < 0) return null;

  const headerLine = lines[tableStart];
  const headers = headerLine
    .split('|')
    .slice(1, -1)
    .map(trimCell)
    .filter((h, idx, arr) => h.length > 0 || arr.length > 1);
  if (headers.length === 0) return null;

  const rows = [];
  for (let i = tableStart + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('|')) break;
    if (isSeparatorRow(line)) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(trimCell);
    while (cells.length < headers.length) cells.push('');
    rows.push(cells.slice(0, headers.length));
  }

  const preamble = lines.slice(0, tableStart);
  return { preamble, headers, rows };
}

module.exports = { parseKbPipeTable, trimCell };
