/**
 * Regola ConvAI: campi opzionali con "" = assenti. Normalizzazione body gateway (mirror TS).
 */

'use strict';

const RULE_ID = 'omnia.convai.optional-empty-string/v1';

function isRecord(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isEmptyOptionalSentinel(value) {
  if (value === '' || value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (isRecord(value) && Object.keys(value).length === 0) return true;
  return false;
}

function stripEmptyConvaiOptionalFields(value) {
  if (value === '' || value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    const next = value
      .map((item) => stripEmptyConvaiOptionalFields(item))
      .filter((item) => item !== undefined && !isEmptyOptionalSentinel(item));
    return next.length === 0 ? undefined : next;
  }
  if (isRecord(value)) {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const stripped = stripEmptyConvaiOptionalFields(raw);
      if (stripped === undefined || isEmptyOptionalSentinel(stripped)) continue;
      out[key] = stripped;
    }
    return Object.keys(out).length === 0 ? undefined : out;
  }
  return value;
}

/** Mutating normalize on gateway request body object. */
function stripEmptyConvaiOptionalFieldsInPlace(body) {
  if (!isRecord(body)) return;
  for (const key of Object.keys(body)) {
    const stripped = stripEmptyConvaiOptionalFields(body[key]);
    if (stripped === undefined || isEmptyOptionalSentinel(stripped)) {
      delete body[key];
    } else {
      body[key] = stripped;
    }
  }
}

module.exports = {
  CONVAI_OPTIONAL_EMPTY_STRING_RULE_ID: RULE_ID,
  isEmptyOptionalSentinel,
  stripEmptyConvaiOptionalFields,
  stripEmptyConvaiOptionalFieldsInPlace,
};
