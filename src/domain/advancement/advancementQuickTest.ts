/**
 * Costruzione del contesto `param` per test/play avanzamento (espressione JS) da mapping SEND e letterali.
 */

import {
  type AdvancementEvalContext,
  type AdvancementValueType,
  validateTypedResult,
} from './advancementDsl';
import { evaluateAdvancementJsExpression } from './advancementJsExpr';

/** Chip UI: contesto prev/param + risultato test. */
export type AdvancementContextChip = {
  key: string;
  label: string;
  value: string;
  /** Solo modalità parametro in focus: stile Precedente (arancione) / Nuovo (verde). */
  tone?: 'precedente' | 'nuovo';
};

/** Snapshot UI quick test per wireKey (invalidazione su cambio riga, NL, DSL o chiusura overlay). */
export type AdvancementQuickTestRowState = {
  chips: AdvancementContextChip[];
  error?: string;
  snapshotRow: string;
  /** `naturalLanguage` in trim al momento del Test (invalida se l’utente modifica la descrizione). */
  snapshotNaturalLanguage: string;
  snapshotDsl: string;
};

export function formatChipValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Valore del Test avanzamento in forma leggibile: data ISO (YYYY-MM-DD), numeri come cifre, stringhe in chiaro.
 */
export function formatAdvancementTestResultDisplay(normalizedValue: unknown): string {
  if (normalizedValue === null || normalizedValue === undefined) return '—';
  if (typeof normalizedValue === 'string') return normalizedValue;
  if (typeof normalizedValue === 'number' || typeof normalizedValue === 'boolean') {
    return String(normalizedValue);
  }
  return formatChipValue(normalizedValue);
}

/** Campo `param.x` nella DSL: ultimo segmento del wireKey (identificatore semplice). */
export function paramFieldKeyFromWireKey(wireKey: string): string {
  const w = wireKey.trim();
  if (!w) return '';
  const i = w.lastIndexOf('.');
  return i === -1 ? w : w.slice(i + 1);
}

/**
 * Chip Test avanzamento: con `focusWireKey` solo due chip (valore precedente vs nuovo) per quel parametro;
 * senza focus, elenco completo prev/param/risultato (retrocompatibilità test).
 */
export function buildAdvancementContextChips(
  ctx: AdvancementEvalContext,
  resultDisplay?: string,
  options?: { focusWireKey?: string }
): AdvancementContextChip[] {
  const focus = options?.focusWireKey?.trim();
  if (focus && resultDisplay !== undefined) {
    const fk = paramFieldKeyFromWireKey(focus);
    if (fk) {
      const prevObj = ctx.prev || {};
      const paramObj = ctx.param || {};
      const oldRaw = Object.prototype.hasOwnProperty.call(prevObj, fk)
        ? prevObj[fk]
        : Object.prototype.hasOwnProperty.call(paramObj, fk)
          ? paramObj[fk]
          : undefined;
      return [
        {
          key: '__focus_prev',
          label: 'Precedente',
          value: formatChipValue(oldRaw),
          tone: 'precedente',
        },
        {
          key: '__focus_new',
          label: 'Nuovo',
          value: resultDisplay,
          tone: 'nuovo',
        },
      ];
    }
  }

  const chips: AdvancementContextChip[] = [];
  for (const k of Object.keys(ctx.prev || {}).sort()) {
    chips.push({
      key: `prev.${k}`,
      label: `prev · ${k}`,
      value: formatChipValue(ctx.prev[k]),
    });
  }
  for (const k of Object.keys(ctx.param || {}).sort()) {
    chips.push({
      key: `param.${k}`,
      label: `param · ${k}`,
      value: formatChipValue(ctx.param[k]),
    });
  }
  if (resultDisplay !== undefined) {
    chips.push({
      key: '__result',
      label: 'Risultato',
      value: resultDisplay,
    });
  }
  return chips;
}

/** Sottoinsieme del mapping SEND necessario al quick test. */
export type SendRowSnapshot = {
  wireKey: string;
  literalConstant?: string;
  variableRefId?: string;
};

/**
 * Impronta del valore “a sinistra” sulla riga SEND: letterale o binding variabile.
 * Usata per invalidare il risultato Play quando cambia la riga corrente.
 */
export function sendRowValueFingerprint(entry: SendRowSnapshot | undefined): string {
  if (!entry) return '∅';
  return JSON.stringify({
    w: entry.wireKey,
    l: entry.literalConstant ?? '',
    v: entry.variableRefId ?? '',
  });
}

export function coerceLiteralString(raw: string, t: AdvancementValueType): unknown {
  const s = raw.trim();
  if (t === 'String') return s;
  if (t === 'Int') {
    if (!s) throw new Error('Valore vuoto per tipo Int.');
    const n = Number(s);
    if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`Non è un intero valido: "${raw}".`);
    return n;
  }
  if (t === 'Number') {
    if (!s) throw new Error('Valore vuoto per tipo Number.');
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`Non è un numero valido: "${raw}".`);
    return n;
  }
  if (t === 'Date') {
    if (!s) throw new Error('Valore vuoto per tipo Date.');
    return s;
  }
  return s;
}

/**
 * Unisce i letterali di tutte le righe SEND (coercizione per tipo) così `param.altro`
 * resta disponibile nella DSL; la riga `focusWireKey` ha priorità sull’entry corrente.
 */
export function buildParamRecordFromSendMapping(
  entries: readonly SendRowSnapshot[],
  typesByWireKey: Record<string, AdvancementValueType> | undefined,
  focusWireKey: string,
  focusEntry: SendRowSnapshot | undefined
): { param: Record<string, unknown>; error: string | null } {
  const param: Record<string, unknown> = {};
  const fk = paramFieldKeyFromWireKey(focusWireKey);
  if (!fk) {
    return { param: {}, error: 'wireKey non valido.' };
  }

  for (const e of entries) {
    const lit = e.literalConstant?.trim();
    if (!lit) continue;
    const field = paramFieldKeyFromWireKey(e.wireKey);
    if (!field) continue;
    const t = typesByWireKey?.[e.wireKey.trim()] ?? 'String';
    try {
      param[field] = coerceLiteralString(lit, t);
    } catch {
      /* ignora righe con letterale incoerente col tipo */
    }
  }

  const focusLit = focusEntry?.literalConstant?.trim();
  if (focusLit) {
    const t = typesByWireKey?.[focusWireKey.trim()] ?? 'String';
    try {
      param[fk] = coerceLiteralString(focusLit, t);
    } catch (err) {
      return {
        param,
        error: err instanceof Error ? err.message : 'Valore letterale non valido per questa riga.',
      };
    }
  } else if (focusEntry?.variableRefId && !focusLit) {
    return {
      param,
      error:
        'Per il Play serve un valore letterale nella cella del parametro (non solo una variabile di flusso).',
    };
  }

  return { param, error: null };
}

/** Output di `getPlayContext` per UI (prev globale + param da letterali SEND). */
export type AdvancementPlayContextBundle = {
  prev: Record<string, unknown>;
  param: Record<string, unknown>;
  error: string | null;
};

export type AdvancementPlayOutcome =
  | { ok: true; display: string }
  | { ok: false; message: string };

/**
 * Valuta l'espressione JavaScript con contesto batch per Play/Test rapidi.
 */
export function runAdvancementPlayEvaluation(
  dslSource: string,
  ctx: AdvancementEvalContext,
  resultType: AdvancementValueType
): AdvancementPlayOutcome {
  const dslTrim = dslSource.trim();
  if (!dslTrim) {
    return { ok: false, message: 'Espressione vuota.' };
  }
  try {
    const raw = evaluateAdvancementJsExpression(dslTrim, ctx);
    const check = validateTypedResult(raw, resultType);
    if (!check.ok) {
      return { ok: false, message: check.message };
    }
    const display = formatAdvancementTestResultDisplay(check.value);
    return { ok: true, display };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
