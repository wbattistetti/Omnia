/**
 * Semantica valori selettore KB: vuoto vs significativo, acceptance da metadati riga.
 */

'use strict';

const { slugifyColumnId, normalizeCellValue, headerIndex } = require('./kbDialogBindings');

const EXAM_EMPTY = new Set(['', 'nessuno', 'none', 'no', '-']);
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

function isEmptySelectorCellValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return true;
  const norm = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return EMPTY_CELL_VALUES.has(norm);
}

function isEmptySelectorValue(columnId, value) {
  const v = String(value ?? '').trim();
  if (!v || isEmptySelectorCellValue(v)) return true;
  const norm = v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  const col = slugifyColumnId(columnId);
  if (col.includes('esame') && !col.includes('obbligatorio')) {
    return EXAM_EMPTY.has(norm) || norm.startsWith('non_');
  }
  return false;
}

function computeInformKey(bindingWhen, colId, value) {
  const prefix = Object.keys(bindingWhen || {})
    .sort()
    .map((k) => `${k}=${bindingWhen[k]}`)
    .join('|');
  return `${prefix}::${colId}::${value}`.toLowerCase();
}

function rowCellByColumnId(row, headers, columnId) {
  const idx = headerIndex(headers, columnId);
  if (idx < 0) return '';
  return normalizeCellValue(row[idx] ?? '');
}

function resolveRequiresAcceptance({ col, matchedRow, headers, metaRequiresAcceptance }) {
  if (metaRequiresAcceptance === true) return true;
  const rules = col?.acceptanceWhen ?? [];
  if (!matchedRow || rules.length === 0) return false;
  for (const rule of rules) {
    const cell = rowCellByColumnId(matchedRow, headers, rule.metadataColumnId);
    if (cell && cell.toLowerCase() === String(rule.metadataValue ?? '').trim().toLowerCase()) {
      return true;
    }
  }
  return false;
}

function resolveInformTransitionKind(prevValue, nextValue, columnId) {
  const prevEmpty = !prevValue || isEmptySelectorValue(columnId, prevValue);
  const nextEmpty = !nextValue || isEmptySelectorValue(columnId, nextValue);
  if (nextEmpty && !prevEmpty) return 'de_disclosure';
  if (!nextEmpty && !prevEmpty && prevValue.toLowerCase() !== nextValue.toLowerCase()) {
    return 'transition';
  }
  if (!nextEmpty && prevEmpty) return 'disclosure';
  return null;
}

const INFORM_RESPONSE_KEY = '__inform_response';

function parseInformResponse(updates) {
  if (!updates || typeof updates !== 'object') return null;
  const raw = updates[INFORM_RESPONSE_KEY];
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase();
  if (['accept', 'yes', 'si', 'sì', 'ok', 'procedi'].includes(v)) return 'accept';
  if (['reject', 'no', 'rifiuta', 'annulla'].includes(v)) return 'reject';
  return null;
}

function emptyInformState() {
  return {
    lastDisclosed: {},
    acknowledged: [],
    informPending: null,
  };
}

function cloneInformState(state) {
  const base = state && typeof state === 'object' ? state : emptyInformState();
  return {
    lastDisclosed: { ...(base.lastDisclosed ?? {}) },
    acknowledged: [...(base.acknowledged ?? [])],
    informPending: base.informPending ? { ...base.informPending } : null,
  };
}

function invalidateInformForColumns(state, columnIds) {
  const next = cloneInformState(state);
  for (const colId of columnIds) {
    delete next.lastDisclosed[colId];
    if (next.informPending?.colId === colId) next.informPending = null;
  }
  next.acknowledged = next.acknowledged.filter((k) => !columnIds.some((c) => k.includes(`::${c}::`)));
  return next;
}

module.exports = {
  isEmptySelectorValue,
  computeInformKey,
  resolveRequiresAcceptance,
  resolveInformTransitionKind,
  parseInformResponse,
  INFORM_RESPONSE_KEY,
  emptyInformState,
  cloneInformState,
  invalidateInformForColumns,
};
