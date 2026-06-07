/**
 * Risoluzione frasi UC inform (disclosure, de-disclosure, transition) a runtime.
 */

'use strict';

const {
  slugifyColumnId,
  normalizeCellValue,
  headerIndex,
} = require('./kbDialogBindings');
const { getNaturalLabel } = require('./kbDialogSayResolver');
const {
  isEmptySelectorValue,
  resolveRequiresAcceptance,
  resolveInformTransitionKind,
} = require('./kbDialogSelectorSemantics');

const DEFAULT_REJECT_SAY =
  'Non possiamo procedere con questa prestazione. La conversazione termina qui.';

function bindingPrefixMatches(when, binding) {
  for (const [k, v] of Object.entries(when || {})) {
    const got = normalizeCellValue(binding[k] ?? '');
    if (got.toLowerCase() !== normalizeCellValue(v).toLowerCase()) return false;
  }
  return true;
}

function buildBindingPrefix(binding, colId) {
  const out = {};
  for (const [k, v] of Object.entries(binding || {})) {
    if (k === colId) break;
    if (normalizeCellValue(v)) out[k] = v;
  }
  return out;
}

function buildInformPlaceholders(binding, colId, value, prevValue, valueLabels) {
  const map = {};
  for (const [key, raw] of Object.entries(binding || {})) {
    if (!raw) continue;
    map[`${key}_nat`] = getNaturalLabel(key, raw, valueLabels);
  }
  if (colId && value) {
    map[`${colId}_nat`] = getNaturalLabel(colId, value, valueLabels);
    map.new_value_nat = map[`${colId}_nat`];
  }
  if (prevValue) {
    map[`prev_${colId}_nat`] = getNaturalLabel(colId, prevValue, valueLabels);
    map.prev_value_nat = map[`prev_${colId}_nat`];
  }
  map.specialita_nat =
    map.specialita_nat ?? getNaturalLabel('specialita', binding.specialita ?? '', valueLabels);
  map.tipo_visita_nat =
    map.tipo_visita_nat ??
    getNaturalLabel('tipo_visita', binding.tipo_visita ?? '', valueLabels);
  return map;
}

function interpolateTemplate(template, placeholders) {
  let out = String(template ?? '');
  for (const [key, val] of Object.entries(placeholders)) {
    out = out.split(`{${key}}`).join(val ?? '');
  }
  return out.replace(/\s+/g, ' ').trim();
}

function pickInformRow(index, colId, binding, transitionKind) {
  const entry = index?.inform?.[colId];
  if (!entry?.rows?.length) return null;
  const sorted = [...entry.rows].sort(
    (a, b) => Object.keys(b.bindingWhen || {}).length - Object.keys(a.bindingWhen || {}).length
  );
  for (const row of sorted) {
    if (!bindingPrefixMatches(row.bindingWhen, binding)) continue;
    if (transitionKind === 'de_disclosure' && row.deDisclosureSay?.trim()) return row;
    if (transitionKind === 'transition' && row.transitionSay?.trim()) return row;
    if (transitionKind === 'disclosure' && row.say?.trim()) return row;
  }
  return sorted.find((r) => r.say?.trim()) ?? null;
}

function defaultInformSay(transitionKind, col, value, prevValue, valueLabels) {
  const colNat = getNaturalLabel(col?.columnId ?? col?.headerLabel ?? 'column', value, valueLabels);
  const prevNat = prevValue
    ? getNaturalLabel(col?.columnId ?? col?.headerLabel ?? 'column', prevValue, valueLabels)
    : '';
  const label = col?.promptTemplate ?? col?.headerLabel ?? 'informazione';
  if (transitionKind === 'de_disclosure') {
    return prevNat
      ? `${prevNat.charAt(0).toUpperCase() + prevNat.slice(1)} non è più previsto.`
      : `L'${label} non è più previsto.`;
  }
  if (transitionKind === 'transition') {
    return prevNat && colNat
      ? `Invece di ${prevNat} è previsto ${colNat}.`
      : `È previsto ${colNat}.`;
  }
  return colNat
    ? `Per questa scelta è previsto ${colNat}.`
    : `${label.charAt(0).toUpperCase() + label.slice(1)}?`;
}

function resolveInformSay(params) {
  const {
    dialogIndex,
    col,
    colId,
    binding,
    value,
    prevValue,
    matchedRow,
    headers,
    transitionKind,
  } = params;
  const valueLabels = dialogIndex?.valueLabels ?? {};
  const kind =
    transitionKind ??
    resolveInformTransitionKind(prevValue, value, colId) ??
    'disclosure';
  const row = pickInformRow(dialogIndex, colId, binding, kind);
  const placeholders = buildInformPlaceholders(binding, colId, value, prevValue, valueLabels);

  let say = '';
  if (kind === 'de_disclosure') {
    say = row?.deDisclosureSay
      ? interpolateTemplate(row.deDisclosureSay, placeholders)
      : defaultInformSay(kind, col, value, prevValue, valueLabels);
  } else if (kind === 'transition') {
    say = row?.transitionSay
      ? interpolateTemplate(row.transitionSay, placeholders)
      : defaultInformSay(kind, col, value, prevValue, valueLabels);
  } else {
    say = row?.say
      ? interpolateTemplate(row.say, placeholders)
      : defaultInformSay(kind, col, value, prevValue, valueLabels);
  }

  const requiresAcceptance = resolveRequiresAcceptance({
    col,
    matchedRow,
    headers,
    metaRequiresAcceptance: row?.requiresAcceptance,
  });

  if (requiresAcceptance && !/\?\s*$/.test(say) && !/procediamo/i.test(say)) {
    say = `${say} Procediamo?`;
  }

  return {
    say: say.trim(),
    useCaseId: dialogIndex?.inform?.[colId]?.useCaseId ?? null,
    useCaseKind: 'inform',
    transitionKind: kind,
    requiresAcceptance,
  };
}

function columnWantsInform(col) {
  return col?.informOnAutofill === true;
}

function hasInformTemplate(dialogIndex, colId) {
  const entry = dialogIndex?.inform?.[colId];
  return Boolean(entry?.rows?.some((r) => r.say?.trim() || r.transitionSay?.trim() || r.deDisclosureSay?.trim()));
}

module.exports = {
  resolveInformSay,
  columnWantsInform,
  hasInformTemplate,
  buildBindingPrefix,
  DEFAULT_REJECT_SAY,
  interpolateTemplate,
};
