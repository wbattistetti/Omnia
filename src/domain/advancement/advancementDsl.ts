/**
 * Tipi e validazione risultato per regole di avanzamento SEND.
 * La valutazione è JavaScript (vedi advancementJsExpr.ts); il campo persistito resta `dslExpression` (stringa sorgente).
 */

import { evaluateAdvancementJsExpression } from './advancementJsExpr';

export type AdvancementValueType = 'Date' | 'Int' | 'String' | 'Number';

/** Messaggio unico quando il valore dell'espressione JS non è compatibile col tipo del parametro SEND. */
export const ADVANCEMENT_TYPE_MISMATCH_MESSAGE =
  'Il risultato deve rispettare il tipo dichiarato (String, Date, Int, Number).';

export interface AdvancementEvalContext {
  prev: Record<string, unknown>;
  param: Record<string, unknown>;
}

/**
 * Normalizza il valore prodotto da un'espressione JS al tipo del parametro (Date accetta Date, timestamp ms, ISO string).
 */
export function validateTypedResult(
  value: unknown,
  expected: AdvancementValueType
): { ok: true; value: unknown } | { ok: false; message: string } {
  if (expected === 'Date') {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return { ok: true, value: value.toISOString().slice(0, 10) };
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return { ok: true, value: d.toISOString().slice(0, 10) };
      }
    }
    const s = coerceToIsoDateString(value);
    if (!s) return { ok: false, message: ADVANCEMENT_TYPE_MISMATCH_MESSAGE };
    return { ok: true, value: s };
  }
  if (expected === 'Int') {
    if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
      return { ok: false, message: ADVANCEMENT_TYPE_MISMATCH_MESSAGE };
    }
    return { ok: true, value };
  }
  if (expected === 'Number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, message: ADVANCEMENT_TYPE_MISMATCH_MESSAGE };
    }
    return { ok: true, value };
  }
  if (expected === 'String') {
    if (typeof value !== 'string') {
      return { ok: false, message: ADVANCEMENT_TYPE_MISMATCH_MESSAGE };
    }
    return { ok: true, value };
  }
  return { ok: false, message: ADVANCEMENT_TYPE_MISMATCH_MESSAGE };
}

function parseIsoDateOnly(s: string): string | null {
  const t = s.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function coerceToIsoDateString(v: unknown): string | null {
  if (typeof v === 'string') return parseIsoDateStringLoose(v);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return null;
}

function parseIsoDateStringLoose(s: string): string | null {
  const t = s.trim();
  const day = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  if (day) return parseIsoDateOnly(day[1]);
  return null;
}

/**
 * Applica regole in ordine SEND; ogni regola attiva valuta un'espressione JavaScript.
 */
export function applyAdvancementRulesOrdered(options: {
  inputOrder: string[];
  advancementEnabled: Record<string, boolean>;
  dslByParam: Record<string, string>;
  types: Record<string, AdvancementValueType>;
  prev: Record<string, unknown>;
  paramConstants: Record<string, unknown>;
}): { values: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  const next: Record<string, unknown> = { ...options.paramConstants };

  for (const name of options.inputOrder) {
    const en = options.advancementEnabled[name];
    const dsl = (options.dslByParam[name] || '').trim();
    if (!en) {
      if (!Object.prototype.hasOwnProperty.call(next, name)) {
        errors.push(`Parametro "${name}": valore costante mancante.`);
      }
      continue;
    }
    if (!dsl) {
      errors.push(`Parametro "${name}": avanzamento attivo ma espressione vuota.`);
      continue;
    }
    try {
      const ctx: AdvancementEvalContext = { prev: options.prev, param: { ...options.paramConstants } };
      const raw = evaluateAdvancementJsExpression(dsl, ctx);
      const t = options.types[name] ?? 'String';
      const check = validateTypedResult(raw, t);
      if (!check.ok) {
        errors.push(`Parametro "${name}": ${check.message}`);
        continue;
      }
      next[name] = check.value;
    } catch (e) {
      errors.push(`Parametro "${name}": ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { values: next, errors };
}
