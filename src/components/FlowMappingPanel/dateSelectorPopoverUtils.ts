/**
 * Parsing e formattazione per DateSelectorPopover (ISO locale, IT gg/mm/aaaa, costanti Now/Tomorrow).
 */

const ISO_DATE_FULL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True se il valore è una delle costanti simboliche supportate (normalizzate PascalCase). */
export function isSymbolicDateConstant(value: string): boolean {
  const t = value.trim();
  return /^Now$/i.test(t) || /^Tomorrow$/i.test(t);
}

/** Data locale `YYYY-MM-DD` senza shift UTC. */
export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO data-only → `Date` mezzanotte locale. */
export function parseIsoDateLocal(iso: string): Date | undefined {
  const m = iso.trim().match(ISO_DATE_FULL_RE);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return undefined;
  return dt;
}

/** `gg/mm/aaaa` → ISO `YYYY-MM-DD` o null se invalido. */
export function parseItalianDateString(raw: string): string | null {
  const s = raw.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!match) return null;
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return toIsoDateLocal(dt);
}

/** ISO → `gg/mm/aaaa` per visualizzazione input. */
export function formatIsoToItalianDisplay(iso: string): string {
  const dt = parseIsoDateLocal(iso);
  if (!dt) return iso.trim();
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Normalizza costante simbolica da testo libero (IT/EN). */
export function parseSymbolicFromText(raw: string): 'Now' | 'Tomorrow' | null {
  const t = raw.trim().toLowerCase();
  if (/^(now|oggi)$/.test(t)) return 'Now';
  if (/^(tomorrow|domani)$/.test(t)) return 'Tomorrow';
  return null;
}

/** Costante → etichetta mostrata nell’input (solo lettura effetto). */
export function symbolicToDisplayLabel(symbolic: string): string {
  if (/^Now$/i.test(symbolic)) return 'Oggi';
  if (/^Tomorrow$/i.test(symbolic)) return 'Domani';
  return symbolic.trim();
}

/** Valore controllato → stringa mostrata nell’input. */
export function valueToInputDisplay(value: string): string {
  const v = value.trim();
  if (!v) return '';
  if (isSymbolicDateConstant(v)) return symbolicToDisplayLabel(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatIsoToItalianDisplay(v);
  return v;
}

/**
 * Interpreta il testo al blur: ISO, gg/mm/aaaa, parole chiave simboliche.
 * Restituisce la stringa da inviare al backend o null se vuoto / invalido (caller può ripristinare).
 */
export function commitTextInputToValue(raw: string): string | null {
  const s = raw.trim();
  if (!s) return '';
  const sym = parseSymbolicFromText(s);
  if (sym) return sym;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return parseIsoDateLocal(s) != null ? s : null;
  }
  const itParsed = parseItalianDateString(s);
  if (itParsed) return itParsed;
  return null;
}
