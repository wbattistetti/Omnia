/**
 * Applica hint SEND (sendPath + valueKind) su body JSON. Generico per qualsiasi Backend Call.
 */

'use strict';

const { resolveValueKindToConcrete } = require('./valueKindResolver');

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function getNested(obj, dottedPath) {
  const parts = String(dottedPath)
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function setNestedValueAtDottedPath(target, dottedPath, value) {
  const parts = String(dottedPath)
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return;
  let cur = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    if (!isRecord(cur[key])) cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

function isEmptySlot(v) {
  return v === undefined || v === null || (typeof v === 'string' && !v.trim());
}

function looksLikeSurfaceLiteral(current, hint) {
  if (typeof current !== 'string') return false;
  const s = hint.surface?.trim().toLowerCase();
  return s && current.trim().toLowerCase() === s;
}

/**
 * Applica hint solo se il path è vuoto o contiene ancora il letterale surface (LLM non ha risolto).
 */
function applySendHintToBody(body, hint, options = {}) {
  const path = String(hint.sendPath ?? '').trim();
  if (!path || !hint.valueKind?.trim()) return false;

  const current = getNested(body, path);
  if (!isEmptySlot(current) && !looksLikeSurfaceLiteral(current, hint)) {
    return false;
  }

  const concrete = resolveValueKindToConcrete(hint.valueKind, {
    referenceDate: options.referenceDate,
    surfaceLiteral: hint.surface,
  });
  if (concrete == null) return false;

  setNestedValueAtDottedPath(body, path, concrete);
  return true;
}

function applySendHintsToBody(body, hints, options = {}) {
  if (!isRecord(body)) return 0;
  let applied = 0;
  for (const h of hints ?? []) {
    if (applySendHintToBody(body, h, options)) applied += 1;
  }
  return applied;
}

module.exports = {
  getNested,
  setNestedValueAtDottedPath,
  applySendHintToBody,
  applySendHintsToBody,
};
