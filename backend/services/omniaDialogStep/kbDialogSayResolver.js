/**
 * Risoluzione frasi UC dialogo KB a runtime (parità src/domain/knowledgeBase/kbDialog).
 */

'use strict';

const { KB_DIALOG_EXPLICIT_LIST_MAX } = require('./kbDialogConstants');
const {
  slugifyColumnId,
  normalizeCellValue,
  headerIndex,
  distinctColumnValues,
  filterRowsByBinding,
  fillInvalidationTemplate,
} = require('./kbDialogBindings');

const EXAM_EMPTY = new Set(['', 'nessuno', 'none', 'no', '-']);

function isEmptyExamValue(value) {
  const v = normalizeCellValue(value).toLowerCase().replace(/\s+/g, '_');
  return EXAM_EMPTY.has(v) || v.startsWith('non_');
}

function humanizeCell(raw) {
  const v = normalizeCellValue(raw);
  if (!v) return '';
  const norm = v.toLowerCase().replace(/\s+/g, '_');
  const map = {
    prima_visita: 'prima visita',
    controllo: 'visita di controllo',
    cardiologia: 'cardiologica',
    radiologia: 'radiologica',
    ecg: 'ECG',
    nessuno: '',
  };
  if (Object.prototype.hasOwnProperty.call(map, norm)) return map[norm];
  return v.replace(/_/g, ' ').trim();
}

function getNaturalLabel(columnId, rawValue, valueLabels) {
  const key = normalizeCellValue(rawValue).toLowerCase();
  const col = valueLabels?.[columnId];
  if (col && col[key]) return col[key];
  return humanizeCell(rawValue);
}

function interpolateTemplate(template, placeholders) {
  let out = String(template ?? '');
  for (const [key, val] of Object.entries(placeholders)) {
    out = out.split(`{${key}}`).join(val ?? '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

function detectExamColumnId(headers) {
  for (const h of headers) {
    const id = slugifyColumnId(h);
    if (id.includes('esame') && !id.includes('obbligatorio')) return id;
  }
  return undefined;
}

function buildCompletePlaceholders(binding, headers, matchedRow, valueLabels) {
  const map = {};
  for (const [colId, raw] of Object.entries(binding)) {
    if (!raw) continue;
    map[`${colId}_nat`] = getNaturalLabel(colId, raw, valueLabels);
  }
  map.tipo_visita_nat =
    map.tipo_visita_nat ?? getNaturalLabel('tipo_visita', binding.tipo_visita ?? '', valueLabels);
  map.specialita_nat =
    map.specialita_nat ??
    getNaturalLabel('specialita', binding.specialita ?? binding.specialty ?? '', valueLabels);

  const examCol = detectExamColumnId(headers);
  if (examCol && !isEmptyExamValue(binding[examCol] ?? '')) {
    const nat = getNaturalLabel(examCol, binding[examCol], valueLabels);
    map.esame_suffix = nat ? ` con ${nat}` : '';
  } else {
    map.esame_suffix = '';
  }

  if (matchedRow) {
    const idx = headerIndex(headers, 'etichetta');
    if (idx >= 0) {
      const et = normalizeCellValue(matchedRow[idx]);
      if (et) map.etichetta_riga = et;
    }
  }
  return map;
}

function resolveCompleteSay(index, binding, headers, matchedRow) {
  const template = index?.complete?.sayTemplate || index?.completeTemplate || '';
  const placeholders = buildCompletePlaceholders(
    binding,
    headers,
    matchedRow,
    index?.valueLabels ?? {}
  );
  const sayCore = interpolateTemplate(template, placeholders);
  return { sayCore, say: sayCore, useCaseId: index?.complete?.useCaseId ?? null, useCaseKind: 'complete' };
}

function bindingPrefixMatches(when, binding) {
  for (const [k, v] of Object.entries(when)) {
    const got = normalizeCellValue(binding[k] ?? '');
    if (got.toLowerCase() !== normalizeCellValue(v).toLowerCase()) return false;
  }
  return true;
}

function resolveAcquisitionSay(index, selectorColumnId, binding, col, allowedValues) {
  const entry = index?.acquisition?.[selectorColumnId];
  if (entry?.rows?.length) {
    const sorted = [...entry.rows].sort(
      (a, b) => Object.keys(b.bindingWhen).length - Object.keys(a.bindingWhen).length
    );
    for (const row of sorted) {
      if (bindingPrefixMatches(row.bindingWhen, binding)) {
        const say = String(row.say ?? '').trim();
        if (say) {
          return {
            say: interpolateAcquisitionSay(
              say,
              binding,
              index?.valueLabels ?? {},
              allowedValues,
              selectorColumnId
            ),
            useCaseId: entry.useCaseId,
            useCaseKind: 'acquisition',
          };
        }
      }
    }
  }

  return null;
}

function buildAcquisitionPlaceholders(binding, valueLabels) {
  const map = {};
  for (const [colId, raw] of Object.entries(binding ?? {})) {
    if (!normalizeCellValue(raw)) continue;
    map[`${colId}_nat`] = getNaturalLabel(colId, raw, valueLabels);
    map[colId] = raw;
  }
  return map;
}

/** Interpola say acquisition: {col_nat}, [col] da binding, [semantic] da allowedValues. */
function interpolateAcquisitionSay(
  say,
  binding,
  valueLabels,
  allowedValues,
  selectorColumnId
) {
  const raw = String(say ?? '').trim();
  if (!raw) return raw;
  const withCurlies = interpolateTemplate(raw, buildAcquisitionPlaceholders(binding, valueLabels));
  return withCurlies.replace(/\[([a-z0-9_]+)\]/gi, (full, token) => {
    const key = String(token ?? '').trim();
    if (!key) return full;

    if (binding && normalizeCellValue(binding[key] ?? '')) {
      return getNaturalLabel(key, binding[key], valueLabels);
    }

    for (const av of allowedValues ?? []) {
      const semantic = String(av ?? '').trim();
      if (!semantic) continue;
      const normSemantic = normalizeCellValue(semantic).toLowerCase().replace(/\s+/g, '_');
      const normToken = normalizeCellValue(key).toLowerCase().replace(/\s+/g, '_');
      if (normSemantic === normToken) {
        const col = selectorColumnId || key;
        return getNaturalLabel(col, semantic, valueLabels);
      }
      const nat = getNaturalLabel(selectorColumnId || key, semantic, valueLabels);
      const normNat = normalizeCellValue(nat).toLowerCase().replace(/\s+/g, '_');
      if (normNat === normToken) return nat;
    }

    for (const [colId, val] of Object.entries(binding ?? {})) {
      if (!normalizeCellValue(val)) continue;
      const nat = getNaturalLabel(colId, val, valueLabels);
      const normNat = normalizeCellValue(nat).toLowerCase().replace(/\s+/g, '_');
      const normToken = normalizeCellValue(key).toLowerCase().replace(/\s+/g, '_');
      if (normNat === normToken) return nat;
    }

    return full;
  });
}

function listSelectorColumns(selectorSpec) {
  if (!selectorSpec || !Array.isArray(selectorSpec.columns)) return [];
  return selectorSpec.columns
    .filter((c) => c.role === 'selector')
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.headerLabel).localeCompare(b.headerLabel, 'it'));
}

function findCorrectionIncompatibilities(priorBinding, merged, headers, rows, selectorColumns, triggerColId) {
  const ordered = selectorColumns.map((c) => slugifyColumnId(c.headerLabel));
  const triggerIdx = ordered.indexOf(triggerColId);
  if (triggerIdx < 0) return [];

  const incompatibles = [];
  for (let i = triggerIdx + 1; i < ordered.length; i += 1) {
    const colId = ordered[i];
    const val = normalizeCellValue(priorBinding[colId] ?? merged[colId] ?? '');
    if (!val) continue;

    const walkBinding = {};
    for (let j = 0; j <= i; j += 1) {
      const cid = ordered[j];
      if (j <= triggerIdx) {
        walkBinding[cid] = merged[cid];
      } else if (cid === colId) {
        walkBinding[cid] = val;
      } else {
        const prev = normalizeCellValue(priorBinding[cid] ?? merged[cid] ?? '');
        if (prev) walkBinding[cid] = prev;
      }
    }
    if (filterRowsByBinding(rows, headers, walkBinding).length === 0) {
      incompatibles.push({ columnId: colId, value: val });
    }
  }
  return incompatibles;
}

function resolveCorrectionMessages(index, triggerColId, incompatibles, merged, partialRows, headers, rows, valueLabels) {
  const messages = [];
  const cleared = { ...merged };

  for (const inc of incompatibles) {
    const tplEntry = (index?.correction ?? []).find(
      (c) => c.triggerColumnId === triggerColId && c.incompatibleColumnId === inc.columnId
    );
    const partialWithout = { ...cleared };
    delete partialWithout[inc.columnId];
    const altRows = filterRowsByBinding(rows, headers, partialWithout);
    const colIdx = headerIndex(headers, inc.columnId);
    const alternatives = colIdx >= 0 ? distinctColumnValues(altRows, colIdx) : [];
    let alternativa = alternatives.find((a) => a.toLowerCase() !== inc.value.toLowerCase()) ?? alternatives[0] ?? '';
    let alternativaMessaggio = alternativa ? `Propongo ${getNaturalLabel(inc.columnId, alternativa, valueLabels)}.` : '';

    if (alternatives.length === 1) {
      cleared[inc.columnId] = alternatives[0];
      alternativaMessaggio = `Diventa ${getNaturalLabel(inc.columnId, alternatives[0], valueLabels)}.`;
    } else {
      delete cleared[inc.columnId];
    }

    const vars = {
      [`${triggerColId}_nat`]: getNaturalLabel(triggerColId, merged[triggerColId] ?? '', valueLabels),
      [`${inc.columnId}_nat`]: getNaturalLabel(inc.columnId, inc.value, valueLabels),
      alternativa_messaggio: alternativaMessaggio,
      alternativa: alternativaMessaggio,
    };

    const template = tplEntry?.sayTemplate ?? '';
    const msg = template
      ? interpolateTemplate(template, vars)
      : `${getNaturalLabel(inc.columnId, inc.value, valueLabels)} non è compatibile. ${alternativaMessaggio}`;
    messages.push(msg.trim());
  }

  return { messages, binding: cleared };
}

function isCorrectionUpdate(priorBinding, updates) {
  for (const [key, val] of Object.entries(updates)) {
    const prior = normalizeCellValue(priorBinding[key] ?? '');
    const next = normalizeCellValue(val);
    if (prior && next && prior.toLowerCase() !== next.toLowerCase()) return key;
  }
  return null;
}

module.exports = {
  resolveCompleteSay,
  resolveAcquisitionSay,
  findCorrectionIncompatibilities,
  resolveCorrectionMessages,
  isCorrectionUpdate,
  getNaturalLabel,
  interpolateTemplate,
  interpolateAcquisitionSay,
  KB_DIALOG_EXPLICIT_LIST_MAX,
};
