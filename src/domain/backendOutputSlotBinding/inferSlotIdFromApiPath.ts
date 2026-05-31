/**
 * Euristica deterministica: path RECEIVE OpenAPI → `slot_id` del lessico (`CORE_SLOT_IDS`).
 */

import { CORE_SLOT_IDS, UNCLASSIFIED_SLOT_ID } from '@domain/useCaseBundle/projectSlotLexicon';

const CORE_SET = new Set<string>(CORE_SLOT_IDS);

/** Segmento path normalizzato (ultima parte o intero path lowercased). */
function pathHaystack(apiPath: string): string {
  return apiPath.trim().toLowerCase().replace(/\[(\d+|\w+)\]/g, '[]');
}

/**
 * Suggerisce uno `slot_id` canonico da un `apiPath` RECEIVE, o `undefined` se non mappabile.
 */
export function inferSlotIdFromApiPath(apiPath: string): string | undefined {
  const p = pathHaystack(apiPath);
  if (!p || p === 'slots' || p === 'summary' || p === 'done' || p === 'window') return undefined;

  const rules: ReadonlyArray<{ test: RegExp; slotId: string }> = [
    { test: /(starttime|start_time|ora|time\b|orario)/, slotId: 'orario' },
    { test: /\bgiorno\b|daynumber|day_number|slot.*day/, slotId: 'data' },
    { test: /(weekday|dayofweek|giornosettimana|day_name)/, slotId: 'giornosettimana' },
    { test: /(relativedate|relative_date|datarelativa)/, slotId: 'datarelativa' },
    { test: /(\bdate\b|\.date|data\b)/, slotId: 'data' },
    { test: /\bmonth\b/, slotId: 'mese' },
    { test: /(prestazione|service|treatment|appointmenttype)/, slotId: 'prestazione' },
    { test: /\bemail\b/, slotId: 'email' },
    { test: /(telefono|phone|mobile)/, slotId: 'telefono' },
    { test: /(importo|amount|price|cost)/, slotId: 'importo' },
    { test: /\bnome\b|name\b|firstname/, slotId: 'nome' },
    { test: /(conferma|confirm)/, slotId: 'formulaconferma' },
    { test: /(daynumber|numerogiorno)/, slotId: 'numerogiorno' },
  ];

  for (const { test, slotId } of rules) {
    if (test.test(p) && CORE_SET.has(slotId)) return slotId;
  }
  return undefined;
}

export function inferFormatForSlotId(slotId: string): string | undefined {
  switch (slotId) {
    case 'data':
      return 'YYYY-MM-DD';
    case 'orario':
      return 'HH:mm';
    default:
      return undefined;
  }
}

export function isClassifiedSlotId(slotId: string): boolean {
  const s = slotId.trim().toLowerCase();
  return Boolean(s) && s !== UNCLASSIFIED_SLOT_ID && CORE_SET.has(s);
}
