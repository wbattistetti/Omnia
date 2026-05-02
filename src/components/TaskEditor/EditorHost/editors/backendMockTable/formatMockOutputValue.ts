/**
 * Formattazione valori cella output mock table: JSON compatto vs «Pretty».
 *
 * Pretty (vista umana): se il valore è un array di oggetti che sembrano **intervalli data/ora**
 * (coppie di chiavi note o esattamente due stringhe ISO per oggetto), mostra una riga per elemento
 * in locale italiano; altrimenti JSON indentato. Nessun nome colonna cablato (es. non serve "slots").
 */

import { stableJsonStringify } from '../../../../../utils/stableJsonStringify';

export type MockOutputValueFormat = 'js' | 'pretty';

/** Coppie (inizio, fine) case-insensitive sui nomi proprietà. */
const INTERVAL_KEY_PAIRS: readonly [string, string][] = [
  ['start', 'end'],
  ['from', 'to'],
  ['begin', 'end'],
  ['startTime', 'endTime'],
  ['start_at', 'end_at'],
  ['dateStart', 'dateEnd'],
];

function getKeyCI(obj: Record<string, unknown>, wantedLower: string): string | undefined {
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === wantedLower) return k;
  }
  return undefined;
}

/** Ritorna le due etichette logiche (lowercase) della prima coppia trovata, es. `['start','end']`. */
function findIntervalLogicalPair(sample: Record<string, unknown>): [string, string] | null {
  for (const [a, b] of INTERVAL_KEY_PAIRS) {
    const ka = getKeyCI(sample, a);
    const kb = getKeyCI(sample, b);
    if (ka && kb && ka !== kb) return [a, b];
  }
  return null;
}

function parseIsoLikeDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Una riga testuale per un intervallo (stile es. `2/5/2026 h 14 – h 14:30`).
 * Generico: non dipende dal nome della colonna output.
 */
export function formatIntervalRowItalian(start: Date, end: Date | null): string {
  const datePart = (d: Date) =>
    d.toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric', year: 'numeric' });
  const hourPart = (d: Date) => {
    const m = d.getMinutes();
    const h = d.getHours();
    return m === 0 ? `h ${h}` : `h ${h}:${String(m).padStart(2, '0')}`;
  };
  if (!end) {
    return `${datePart(start)} ${hourPart(start)}`;
  }
  if (start.toDateString() === end.toDateString()) {
    return `${datePart(start)} ${hourPart(start)} – ${hourPart(end)}`;
  }
  return `${datePart(start)} ${hourPart(start)} – ${datePart(end)} ${hourPart(end)}`;
}

/**
 * Se `value` è un array di oggetti «intervallo data/ora», ritorna righe leggibili (locale it);
 * altrimenti `null` → il chiamante usa JSON pretty.
 */
export function tryFormatArrayOfIsoIntervalRowsHuman(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const lines: string[] = [];
  let logicalPair: [string, string] | null = null;
  /** Fallback: stesse due chiavi stringa (ordinate) su ogni riga, valori ISO. */
  let twoStringKeys: [string, string] | null = null;

  for (let i = 0; i < value.length; i++) {
    const el = value[i];
    if (el === null || typeof el !== 'object' || Array.isArray(el)) return null;
    const rec = el as Record<string, unknown>;

    if (i === 0) {
      logicalPair = findIntervalLogicalPair(rec);
      if (!logicalPair) {
        const strKeys = Object.keys(rec).filter((k) => typeof rec[k] === 'string').sort();
        if (strKeys.length !== 2) return null;
        const d0 = parseIsoLikeDate(rec[strKeys[0]]);
        const d1 = parseIsoLikeDate(rec[strKeys[1]]);
        if (!d0 || !d1) return null;
        twoStringKeys = [strKeys[0], strKeys[1]];
      }
    }

    let startD: Date | null;
    let endD: Date | null;

    if (logicalPair) {
      const [la, lb] = logicalPair;
      const ka = getKeyCI(rec, la);
      const kb = getKeyCI(rec, lb);
      if (!ka || !kb) return null;
      startD = parseIsoLikeDate(rec[ka]);
      endD = parseIsoLikeDate(rec[kb]);
      if (!startD) return null;
    } else if (twoStringKeys) {
      const [k0, k1] = twoStringKeys;
      const sk = Object.keys(rec)
        .filter((k) => typeof rec[k] === 'string')
        .sort();
      if (sk.length !== 2 || sk[0] !== k0 || sk[1] !== k1) return null;
      const d0 = parseIsoLikeDate(rec[k0])!;
      const d1 = parseIsoLikeDate(rec[k1])!;
      startD = d0.getTime() <= d1.getTime() ? d0 : d1;
      endD = d0.getTime() <= d1.getTime() ? d1 : d0;
    } else {
      return null;
    }

    lines.push(formatIntervalRowItalian(startD, endD));
  }

  return lines.join('\n');
}

/** JSON compatto (ordine chiavi stabile dove applicabile). */
export function toMinifiedJson(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  return stableJsonStringify(value);
}

/** JSON indentato 2 spazi; fallback su minificato se non serializzabile. */
export function toPrettyJson(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return JSON.stringify(JSON.parse(stableJsonStringify(value)), null, 2);
    } catch {
      return stableJsonStringify(value);
    }
  }
}

export function formatMockOutputValue(value: unknown, mode: MockOutputValueFormat): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'object') return String(value);
  if (mode === 'pretty') {
    const human = tryFormatArrayOfIsoIntervalRowsHuman(value);
    if (human !== null) return human;
    return toPrettyJson(value);
  }
  return toMinifiedJson(value);
}

/** Una riga per anteprima collassata (pulsante cella). */
export function singleLinePreview(multiline: string, maxLen: number): string {
  const one = multiline.replace(/\s+/g, ' ').trim();
  if (one.length <= maxLen) return one;
  return `${one.slice(0, maxLen)}…`;
}
