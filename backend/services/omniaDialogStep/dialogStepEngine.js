/**
 * Motore runtime dialogo KB: filtra tabella, prossima domanda, invalidazione, completamento.
 */

'use strict';

const {
  slugifyColumnId,
  normalizeCellValue,
  headerIndex,
  distinctColumnValues,
  filterRowsByBinding,
  listAskableColumns,
  fillInvalidationTemplate,
} = require('./kbDialogBindings');

function normalizeUpdates(updates, headers) {
  const out = {};
  if (!updates || typeof updates !== 'object') return out;
  for (const [key, raw] of Object.entries(updates)) {
    const val = normalizeCellValue(raw);
    if (!val) continue;
    const idx = headerIndex(headers, key);
    if (idx < 0) continue;
    out[slugifyColumnId(headers[idx])] = val;
  }
  return out;
}

function bindingKeysCanonical(binding, headers) {
  const out = {};
  for (const [key, val] of Object.entries(binding)) {
    const idx = headerIndex(headers, key);
    if (idx < 0) continue;
    const v = normalizeCellValue(val);
    if (!v) continue;
    out[slugifyColumnId(headers[idx])] = v;
  }
  return out;
}

function listSelectorColumns(selectorSpec) {
  if (!selectorSpec || !Array.isArray(selectorSpec.columns)) return [];
  return selectorSpec.columns
    .filter((c) => c.role === 'selector')
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.headerLabel).localeCompare(b.headerLabel, 'it'));
}

function applyAutoFills(binding, headers, rows, selectorSpec) {
  const next = { ...binding };
  for (const col of listSelectorColumns(selectorSpec)) {
    const colId = slugifyColumnId(col.headerLabel);
    if (next[colId]) continue;
    const idx = headerIndex(headers, col.headerLabel);
    if (idx < 0) continue;
    const filtered = filterRowsByBinding(rows, headers, next);
    const distinct = distinctColumnValues(filtered, idx);
    if (distinct.length === 1) {
      next[colId] = distinct[0];
    }
  }
  return next;
}

function buildAskSay(col, allowedValues) {
  const label = String(col.promptTemplate ?? col.headerLabel ?? '').trim();
  const policy =
    col.askPolicy === 'required' ? ' (obbligatoria)' : ' (se necessario)';
  const base = label.includes('(') ? label : `${label}${policy}`;
  if (col.promptType === 'open_question' || allowedValues.length === 0) {
    return `${base}?`;
  }
  if (allowedValues.length <= 6) {
    return `${base}: ${allowedValues.join(', ')}?`;
  }
  return `${base}?`;
}

function pickInvalidationTemplate(selectorSpec) {
  const templates = selectorSpec?.invalidationTemplates ?? [];
  const approved = templates.find((t) => t.approved && t.template?.trim());
  if (approved) return approved;
  return templates.find((t) => t.template?.trim()) ?? null;
}

function rowToObject(row, headers) {
  const out = {};
  for (let i = 0; i < headers.length; i += 1) {
    const h = String(headers[i] ?? '').trim();
    if (!h) continue;
    out[slugifyColumnId(h)] = normalizeCellValue(row[i] ?? '') || '-';
    out[h] = out[slugifyColumnId(h)];
  }
  return out;
}

/**
 * @param {object} params
 * @param {{ headers: string[], rows: string[][] }} params.grid
 * @param {object} params.selectorSpec
 * @param {Record<string, string>} params.binding
 * @param {Record<string, string>} [params.updates]
 */
function executeDialogStep({ grid, selectorSpec, binding, updates }) {
  const headers = grid.headers;
  const rows = grid.rows;
  const askable = listAskableColumns(selectorSpec);

  const priorBinding = bindingKeysCanonical(binding, headers);
  const normalizedUpdates = normalizeUpdates(updates, headers);
  const updateKeys = Object.keys(normalizedUpdates);

  let merged = { ...priorBinding };
  const rowsBefore = filterRowsByBinding(rows, headers, merged);

  for (const colId of updateKeys) {
    merged[colId] = normalizedUpdates[colId];
  }

  let filtered = filterRowsByBinding(rows, headers, merged);

  if (filtered.length === 0 && rowsBefore.length > 0 && updateKeys.length > 0) {
    const rejectedColId = updateKeys[updateKeys.length - 1];
    const rejectedVal = merged[rejectedColId];
    const partial = { ...merged };
    delete partial[rejectedColId];
    const partialRows = filterRowsByBinding(rows, headers, partial);
    const col = askable.find((c) => slugifyColumnId(c.headerLabel) === rejectedColId);
    const colIdx = headerIndex(headers, rejectedColId);
    const alternatives = colIdx >= 0 ? distinctColumnValues(partialRows, colIdx) : [];
    const alt = alternatives.find((a) => a.toLowerCase() !== String(rejectedVal).toLowerCase()) ?? alternatives[0] ?? '';

    const tpl = pickInvalidationTemplate(selectorSpec);
    const colLabel = col?.promptTemplate ?? rejectedColId;
    const say = tpl
      ? fillInvalidationTemplate(tpl.template, {
          colonna: colLabel,
          valore_rifiutato: rejectedVal,
          alternativa_suggerita: alt,
          alternativa: alt,
          [rejectedColId]: rejectedVal,
          specialita: partial.specialita ?? merged.specialita ?? '',
          tipo_visita: partial.tipo_visita ?? merged.tipo_visita ?? '',
        })
      : `La combinazione scelta non è disponibile. ${alt ? `Può andare bene ${alt}.` : ''}`;

    return {
      status: 'invalid',
      say: say.trim(),
      binding: partial,
      rejected: { columnId: rejectedColId, value: rejectedVal, alternative: alt },
      remainingRowCount: partialRows.length,
      allowedValues: alternatives,
    };
  }

  merged = applyAutoFills(merged, headers, rows, selectorSpec);
  filtered = filterRowsByBinding(rows, headers, merged);

  const pending = askable.filter((col) => {
    const colId = slugifyColumnId(col.headerLabel);
    return !normalizeCellValue(merged[colId]);
  });

  if (pending.length === 0 || filtered.length <= 1) {
    const matched = filtered[0] ?? null;
    const say = matched
      ? 'Perfetto, ho trovato la combinazione disponibile.'
      : 'Non ho trovato combinazioni disponibili con le scelte fatte.';
    return {
      status: filtered.length > 0 ? 'complete' : 'error',
      say,
      binding: merged,
      remainingRowCount: filtered.length,
      matchedRow: matched ? rowToObject(matched, headers) : null,
      matchedRows: filtered.map((r) => rowToObject(r, headers)),
    };
  }

  const nextCol = pending[0];
  const colIdx = headerIndex(headers, nextCol.headerLabel);
  const allowedValues = colIdx >= 0 ? distinctColumnValues(filtered, colIdx) : [];

  if (allowedValues.length === 1) {
    const colId = slugifyColumnId(nextCol.headerLabel);
    merged[colId] = allowedValues[0];
    return executeDialogStep({ grid, selectorSpec, binding: merged, updates: {} });
  }

  return {
    status: 'ask',
    say: buildAskSay(nextCol, allowedValues),
    binding: merged,
    nextColumnId: slugifyColumnId(nextCol.headerLabel),
    nextHeaderLabel: nextCol.headerLabel,
    promptType: nextCol.promptType,
    askPolicy: nextCol.askPolicy,
    allowedValues,
    remainingRowCount: filtered.length,
  };
}

module.exports = {
  executeDialogStep,
  normalizeUpdates,
  bindingKeysCanonical,
};
