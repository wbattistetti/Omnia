/**
 * Normalizzazione celle/intestazioni tabella KB per dialog step runtime.
 */

'use strict';

const EMPTY_CELL_VALUES = new Set([
  '-',
  '—',
  '–',
  'n/a',
  'n.a.',
  'na',
  'non applicabile',
  'non_applicable',
  'not_applicable',
  'not applicable',
  'unknown',
  'sconosciuto',
  'unspecified',
  'non specificato',
]);

function slugifyColumnId(header) {
  const slug = String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return slug || 'column';
}

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function isEmptyCellValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return true;
  return EMPTY_CELL_VALUES.has(normalizeToken(v));
}

function normalizeCellValue(value) {
  if (isEmptyCellValue(value)) return '';
  return String(value ?? '').trim();
}

function headerIndex(headers, name) {
  const target = slugifyColumnId(name);
  return headers.findIndex((h) => slugifyColumnId(h) === target);
}

function cellAt(row, index) {
  if (index < 0) return '';
  return normalizeCellValue(row[index] ?? '');
}

function distinctColumnValues(rows, colIndex) {
  const seen = new Set();
  for (const row of rows) {
    const v = cellAt(row, colIndex);
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, 'it'));
}

function rowMatchesBinding(row, headers, binding) {
  for (const [key, rawVal] of Object.entries(binding)) {
    const idx = headerIndex(headers, key);
    if (idx < 0) continue;
    const want = normalizeCellValue(rawVal);
    if (!want) continue;
    const got = cellAt(row, idx);
    if (got.toLowerCase() !== want.toLowerCase()) return false;
  }
  return true;
}

function filterRowsByBinding(rows, headers, binding) {
  const keys = Object.keys(binding).filter((k) => normalizeCellValue(binding[k]));
  if (keys.length === 0) return [...rows];
  return rows.filter((row) => rowMatchesBinding(row, headers, binding));
}

function listAskableColumns(selectorSpec) {
  if (!selectorSpec || !Array.isArray(selectorSpec.columns)) return [];
  return selectorSpec.columns
    .filter((c) => c.role === 'selector' && !c.autoFillSingleValue)
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.headerLabel).localeCompare(b.headerLabel, 'it'));
}

function fillInvalidationTemplate(template, vars) {
  let out = String(template ?? '');
  for (const [key, val] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(val ?? ''));
  }
  return out.replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
}

module.exports = {
  slugifyColumnId,
  normalizeToken,
  isEmptyCellValue,
  normalizeCellValue,
  headerIndex,
  cellAt,
  distinctColumnValues,
  rowMatchesBinding,
  filterRowsByBinding,
  listAskableColumns,
  fillInvalidationTemplate,
};
