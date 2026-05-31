/**
 * Resolver deterministico: valueKind → valore concreto (date ISO, ecc.) per body SEND.
 */

export type ValueKindResolveContext = {
  /** Data di riferimento civile (default: oggi locale). */
  referenceDate?: Date;
  /** Testo surface letterale per parse specific_date (es. "15 giugno 2026"). */
  surfaceLiteral?: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD in calendario locale del Date passato. */
export function toIsoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function endOfMonthIso(ref: Date): string {
  const last = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return toIsoDateLocal(last);
}

function startOfMonthIso(ref: Date): string {
  return `${ref.getFullYear()}-${pad2(ref.getMonth() + 1)}-01`;
}

const IT_MONTHS: Record<string, number> = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

/**
 * Parse superficie italiana "15 giugno" / "15 giugno 2026" → ISO o null.
 */
export function parseItalianSurfaceToIsoDate(
  surface: string,
  ref: Date
): string | null {
  const s = surface.trim().toLowerCase();
  const m = /^(\d{1,2})\s+([a-zàèéìòù]+)(?:\s+(\d{4}))?$/i.exec(s);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const monthName = m[2].normalize('NFD').replace(/\p{M}/gu, '');
  const month = IT_MONTHS[monthName];
  if (month === undefined || day < 1 || day > 31) return null;
  const year = m[3] ? Number.parseInt(m[3], 10) : ref.getFullYear();
  const d = new Date(year, month, day);
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return toIsoDateLocal(d);
}

/**
 * Risolve un valueKind in stringa ISO (date) o null se non applicabile.
 */
export function resolveValueKindToConcrete(
  valueKind: string,
  ctx: ValueKindResolveContext = {}
): string | null {
  const kind = valueKind.trim().toLowerCase();
  const ref = ctx.referenceDate ?? new Date();

  switch (kind) {
    case 'tomorrow': {
      const d = new Date(ref);
      d.setDate(d.getDate() + 1);
      return toIsoDateLocal(d);
    }
    case 'day_after_tomorrow': {
      const d = new Date(ref);
      d.setDate(d.getDate() + 2);
      return toIsoDateLocal(d);
    }
    case 'today':
      return toIsoDateLocal(ref);
    case 'end_of_month':
      return endOfMonthIso(ref);
    case 'start_of_month':
      return startOfMonthIso(ref);
    case 'specific_date': {
      if (ctx.surfaceLiteral?.trim()) {
        return parseItalianSurfaceToIsoDate(ctx.surfaceLiteral, ref);
      }
      return null;
    }
    default:
      return null;
  }
}
