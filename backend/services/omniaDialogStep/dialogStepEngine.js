/**
 * Motore runtime dialogo KB: filtra tabella, UC acquisition/inform/correction/complete.
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
const {
  resolveCompleteSay,
  resolveAcquisitionSay,
  findCorrectionIncompatibilities,
  resolveCorrectionMessages,
  isCorrectionUpdate,
} = require('./kbDialogSayResolver');
const {
  isEmptySelectorValue,
  computeInformKey,
  parseInformResponse,
  cloneInformState,
  invalidateInformForColumns,
  emptyInformState,
} = require('./kbDialogSelectorSemantics');
const {
  resolveInformSay,
  columnWantsInform,
  hasInformTemplate,
  DEFAULT_REJECT_SAY,
} = require('./kbDialogInformResolver');

function normalizeUpdates(updates, headers) {
  const out = {};
  if (!updates || typeof updates !== 'object') return out;
  for (const [key, raw] of Object.entries(updates)) {
    if (key === '__inform_response') continue;
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
  for (const [key, val] of Object.entries(binding || {})) {
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

/** Autofill solo valori vuoti (nessun disclosure). */
function applyEmptyAutofills(binding, headers, rows, selectorSpec) {
  const next = { ...binding };
  for (const col of listSelectorColumns(selectorSpec)) {
    const colId = slugifyColumnId(col.headerLabel);
    if (normalizeCellValue(next[colId])) continue;
    const idx = headerIndex(headers, col.headerLabel);
    if (idx < 0) continue;
    const filtered = filterRowsByBinding(rows, headers, next);
    const distinct = distinctColumnValues(filtered, idx);
    if (distinct.length === 1 && isEmptySelectorValue(colId, distinct[0])) {
      next[colId] = distinct[0];
    }
  }
  return next;
}

/** Autofill tecnico valori significativi univoci (senza inform). */
function applyTechnicalAutofills(binding, headers, rows, selectorSpec, skipColIds = new Set()) {
  const next = { ...binding };
  for (const col of listSelectorColumns(selectorSpec)) {
    const colId = slugifyColumnId(col.headerLabel);
    if (skipColIds.has(colId) || normalizeCellValue(next[colId])) continue;
    const idx = headerIndex(headers, col.headerLabel);
    if (idx < 0) continue;
    const filtered = filterRowsByBinding(rows, headers, next);
    const distinct = distinctColumnValues(filtered, idx);
    if (distinct.length === 1 && !isEmptySelectorValue(colId, distinct[0])) {
      next[colId] = distinct[0];
    }
  }
  return next;
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

function buildBindingPrefixForCol(binding, colId, askable) {
  const out = {};
  for (const col of askable) {
    const id = slugifyColumnId(col.headerLabel);
    if (id === colId) break;
    const v = normalizeCellValue(binding[id] ?? '');
    if (v) out[id] = v;
  }
  return out;
}

function findNextInformAction(params) {
  const { binding, headers, rows, selectorSpec, dialogIndex, informState, askable } = params;
  const filtered = filterRowsByBinding(rows, headers, binding);
  const matched = filtered.length === 1 ? filtered[0] : filtered[0] ?? null;

  for (const col of listSelectorColumns(selectorSpec)) {
    const colId = slugifyColumnId(col.headerLabel);
    const idx = headerIndex(headers, col.headerLabel);
    if (idx < 0) continue;

    const currentVal = normalizeCellValue(binding[colId] ?? '');
    const prevDisclosed = informState.lastDisclosed[colId];
    const prevValue = prevDisclosed?.value;

    if (!currentVal) {
      if (prevValue && !isEmptySelectorValue(colId, prevValue)) {
        if (!columnWantsInform(col) || !hasInformTemplate(dialogIndex, colId)) continue;
        const informKey = computeInformKey(buildBindingPrefixForCol(binding, colId, askable), colId, prevValue);
        if (informState.acknowledged.includes(informKey)) continue;
        return {
          col,
          colId,
          value: '',
          prevValue,
          transitionKind: 'de_disclosure',
          matchedRow: matched,
          informKey,
        };
      }
      continue;
    }

    if (isEmptySelectorValue(colId, currentVal)) continue;
    if (!columnWantsInform(col) || !hasInformTemplate(dialogIndex, colId)) continue;

    const prefix = buildBindingPrefixForCol(binding, colId, askable);
    const informKey = computeInformKey(prefix, colId, currentVal);
    if (informState.acknowledged.includes(informKey)) continue;

    let transitionKind = 'disclosure';
    if (prevValue && !isEmptySelectorValue(colId, prevValue)) {
      if (prevValue.toLowerCase() === currentVal.toLowerCase()) continue;
      transitionKind = 'transition';
    } else if (prevValue && isEmptySelectorValue(colId, prevValue)) {
      transitionKind = 'disclosure';
    }

    const rowFiltered = filterRowsByBinding(rows, headers, binding);
    const rowDistinct = distinctColumnValues(rowFiltered, idx);
    if (rowDistinct.length !== 1 && !prevValue) continue;

    return {
      col,
      colId,
      value: currentVal,
      prevValue,
      transitionKind,
      matchedRow: matched,
      informKey,
    };
  }
  return null;
}

function baseResult(fields) {
  return fields;
}

/**
 * @param {object} params
 * @param {{ headers: string[], rows: string[][] }} params.grid
 * @param {object} params.selectorSpec
 * @param {Record<string, string>} params.binding
 * @param {Record<string, string>} [params.updates]
 * @param {object|null} [params.dialogIndex]
 * @param {object} [params.informState]
 */
function executeDialogStep({
  grid,
  selectorSpec,
  binding,
  updates,
  dialogIndex,
  informState: rawInformState,
}) {
  const headers = grid.headers;
  const rows = grid.rows;
  const askable = listAskableColumns(selectorSpec);
  let informState = cloneInformState(rawInformState ?? emptyInformState());

  const informResponse = parseInformResponse(updates);
  if (informState.informPending && informResponse) {
    const pending = informState.informPending;
    if (informResponse === 'reject') {
      informState.informPending = null;
      const cleared = { ...bindingKeysCanonical(binding, headers) };
      delete cleared[pending.colId];
      for (const col of askable) {
        const id = slugifyColumnId(col.headerLabel);
        if (col.sortOrder > (askable.find((c) => slugifyColumnId(c.headerLabel) === pending.colId)?.sortOrder ?? 999)) {
          delete cleared[id];
        }
      }
      informState = invalidateInformForColumns(informState, [pending.colId]);
      return baseResult({
        status: 'rejected',
        say: DEFAULT_REJECT_SAY,
        useCaseKind: 'inform',
        useCaseId: pending.useCaseId ?? null,
        binding: cleared,
        informState,
        conversationAction: 'terminate',
        remainingRowCount: filterRowsByBinding(rows, headers, cleared).length,
      });
    }
    if (informResponse === 'accept') {
      informState.acknowledged = [...new Set([...informState.acknowledged, pending.informKey])];
      informState.lastDisclosed[pending.colId] = { value: pending.value, say: pending.say };
      informState.informPending = null;
      return executeDialogStep({
        grid,
        selectorSpec,
        binding: bindingKeysCanonical(binding, headers),
        updates: {},
        dialogIndex,
        informState,
      });
    }
  }

  const priorBinding = bindingKeysCanonical(binding, headers);
  const normalizedUpdates = normalizeUpdates(updates, headers);
  const updateKeys = Object.keys(normalizedUpdates);

  let merged = { ...priorBinding };
  const rowsBefore = filterRowsByBinding(rows, headers, merged);

  for (const colId of updateKeys) {
    merged[colId] = normalizedUpdates[colId];
  }

  let filtered = filterRowsByBinding(rows, headers, merged);

  const correctionTrigger = isCorrectionUpdate(priorBinding, normalizedUpdates);
  if (correctionTrigger && dialogIndex) {
    const selectorColumns = listSelectorColumns(selectorSpec);
    const incompatibles = findCorrectionIncompatibilities(
      priorBinding,
      merged,
      headers,
      rows,
      selectorColumns,
      correctionTrigger
    );
    if (incompatibles.length > 0) {
      const { messages, binding: clearedBinding } = resolveCorrectionMessages(
        dialogIndex,
        correctionTrigger,
        incompatibles,
        merged,
        filtered,
        headers,
        rows,
        dialogIndex.valueLabels ?? {}
      );
      const clearedIds = incompatibles.map((i) => i.columnId).filter(Boolean);
      informState = invalidateInformForColumns(informState, clearedIds);
      merged = applyEmptyAutofills(clearedBinding, headers, rows, selectorSpec);
      merged = applyTechnicalAutofills(merged, headers, rows, selectorSpec);
      filtered = filterRowsByBinding(rows, headers, merged);
      return baseResult({
        status: 'correction',
        say: messages.filter(Boolean).join(' '),
        binding: merged,
        useCaseKind: 'correction',
        informState,
        remainingRowCount: filtered.length,
        corrections: incompatibles,
      });
    }
  }

  if (filtered.length === 0 && rowsBefore.length > 0 && updateKeys.length > 0) {
    const rejectedColId = updateKeys[updateKeys.length - 1];
    const rejectedVal = merged[rejectedColId];
    const partial = { ...merged };
    delete partial[rejectedColId];
    const partialRows = filterRowsByBinding(rows, headers, partial);
    const col = askable.find((c) => slugifyColumnId(c.headerLabel) === rejectedColId);
    const colIdx = headerIndex(headers, rejectedColId);
    const alternatives = colIdx >= 0 ? distinctColumnValues(partialRows, colIdx) : [];
    const alt =
      alternatives.find((a) => a.toLowerCase() !== String(rejectedVal).toLowerCase()) ??
      alternatives[0] ??
      '';

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

    return baseResult({
      status: 'invalid',
      say: say.trim(),
      binding: partial,
      informState,
      rejected: { columnId: rejectedColId, value: rejectedVal, alternative: alt },
      remainingRowCount: partialRows.length,
      allowedValues: alternatives,
    });
  }

  merged = applyEmptyAutofills(merged, headers, rows, selectorSpec);
  filtered = filterRowsByBinding(rows, headers, merged);

  const pending = askable.filter((col) => {
    const colId = slugifyColumnId(col.headerLabel);
    return !normalizeCellValue(merged[colId]);
  });

  const nextCol = pending[0];
  if (nextCol) {
    const nextColId = slugifyColumnId(nextCol.headerLabel);
    const colIdx = headerIndex(headers, nextCol.headerLabel);
    const allowedValues = colIdx >= 0 ? distinctColumnValues(filtered, colIdx) : [];

    if (allowedValues.length === 1) {
      const single = allowedValues[0];
      if (isEmptySelectorValue(nextColId, single)) {
        merged[nextColId] = single;
        filtered = filterRowsByBinding(rows, headers, merged);
      } else if (columnWantsInform(nextCol) && hasInformTemplate(dialogIndex, nextColId)) {
        merged[nextColId] = single;
        filtered = filterRowsByBinding(rows, headers, merged);
      } else {
        merged[nextColId] = single;
        return executeDialogStep({
          grid,
          selectorSpec,
          binding: merged,
          updates: {},
          dialogIndex,
          informState,
        });
      }
    }
  }

  merged = applyTechnicalAutofills(merged, headers, rows, selectorSpec);
  filtered = filterRowsByBinding(rows, headers, merged);

  const informAction = findNextInformAction({
    binding: merged,
    headers,
    rows,
    selectorSpec,
    dialogIndex,
    informState,
    askable,
  });

  if (informAction) {
    const resolved = resolveInformSay({
      dialogIndex,
      col: informAction.col,
      colId: informAction.colId,
      binding: merged,
      value: informAction.value,
      prevValue: informAction.prevValue,
      matchedRow: informAction.matchedRow,
      headers,
      transitionKind: informAction.transitionKind,
    });

    if (resolved.requiresAcceptance) {
      informState.informPending = {
        colId: informAction.colId,
        value: informAction.value,
        informKey: informAction.informKey,
        useCaseId: resolved.useCaseId,
        say: resolved.say,
      };
      return baseResult({
        status: 'inform_pending',
        say: resolved.say,
        useCaseId: resolved.useCaseId,
        useCaseKind: 'inform',
        binding: merged,
        informState,
        requiresAcceptance: true,
        informColumnId: informAction.colId,
        remainingRowCount: filtered.length,
      });
    }

    informState.acknowledged = [...new Set([...informState.acknowledged, informAction.informKey])];
    if (informAction.value) {
      informState.lastDisclosed[informAction.colId] = {
        value: informAction.value,
        say: resolved.say,
      };
    } else {
      delete informState.lastDisclosed[informAction.colId];
    }

    return baseResult({
      status: 'inform',
      say: resolved.say,
      useCaseId: resolved.useCaseId,
      useCaseKind: 'inform',
      binding: merged,
      informState,
      requiresAcceptance: false,
      informColumnId: informAction.colId,
      remainingRowCount: filtered.length,
    });
  }

  const pendingAfter = askable.filter((col) => {
    const colId = slugifyColumnId(col.headerLabel);
    return !normalizeCellValue(merged[colId]);
  });

  if (pendingAfter.length === 0 || filtered.length <= 1) {
    const matched = filtered[0] ?? null;
    if (matched && dialogIndex) {
      const resolved = resolveCompleteSay(dialogIndex, merged, headers, matched);
      return baseResult({
        status: filtered.length > 0 ? 'complete' : 'error',
        say: resolved.say,
        sayCore: resolved.sayCore,
        useCaseId: resolved.useCaseId,
        useCaseKind: resolved.useCaseKind,
        binding: merged,
        informState,
        remainingRowCount: filtered.length,
        matchedRow: rowToObject(matched, headers),
        matchedRows: filtered.map((r) => rowToObject(r, headers)),
      });
    }
    const say = matched
      ? 'Perfetto, ho trovato la combinazione disponibile.'
      : 'Non ho trovato combinazioni disponibili con le scelte fatte.';
    return baseResult({
      status: filtered.length > 0 ? 'complete' : 'error',
      say,
      binding: merged,
      informState,
      remainingRowCount: filtered.length,
      matchedRow: matched ? rowToObject(matched, headers) : null,
      matchedRows: filtered.map((r) => rowToObject(r, headers)),
    });
  }

  const askCol = pendingAfter[0];
  const askColIdx = headerIndex(headers, askCol.headerLabel);
  const allowedValues = askColIdx >= 0 ? distinctColumnValues(filtered, askColIdx) : [];
  const askColId = slugifyColumnId(askCol.headerLabel);

  const acquired = dialogIndex
    ? resolveAcquisitionSay(dialogIndex, askColId, merged, askCol, allowedValues)
    : null;
  const say = acquired?.say ?? `${askCol.promptTemplate ?? askCol.headerLabel}?`;

  return baseResult({
    status: 'ask',
    say,
    useCaseId: acquired?.useCaseId ?? null,
    useCaseKind: acquired?.useCaseKind ?? 'acquisition',
    binding: merged,
    informState,
    nextColumnId: askColId,
    nextHeaderLabel: askCol.headerLabel,
    promptType: askCol.promptType,
    askPolicy: askCol.askPolicy,
    allowedValues,
    remainingRowCount: filtered.length,
  });
}

module.exports = {
  executeDialogStep,
  normalizeUpdates,
  bindingKeysCanonical,
};
