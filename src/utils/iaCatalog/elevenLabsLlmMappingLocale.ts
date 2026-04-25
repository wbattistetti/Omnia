/**
 * Lingua agente (BCP-47) → elenco effettivo di `model_id` ammessi da `config/llmMapping.json` (solo ElevenLabs).
 */

import type { LlmMappingPayload } from '@services/iaCatalogApi';

export function primaryLang(locale: string): string {
  return String(locale || '')
    .trim()
    .toLowerCase()
    .split('-')[0];
}

function normalizeModelIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((x) => String(x).trim()).filter(Boolean))];
}

/**
 * Risolve `perLanguage[full]` → `perLanguage[primary]` → stessa lingua primaria (es. voce `it` e file solo `it-IT`)
 * → `nonEnglishAllowedModels`.
 * Se la chiave esiste in `perLanguage` anche con array vuoto, non si fa fallback (evita bug checkbox).
 * Restituisce sempre `string[]`; il chiamante (`allowedIdsForAgent`) decide se `[]` vuoto è `null` (no filtro).
 */
export function effectiveAllowedForLocale(m: LlmMappingPayload, locale: string): string[] {
  const { perLanguage, nonEnglishAllowedModels } = m.elevenlabs;
  const full = locale.trim();
  if (Object.prototype.hasOwnProperty.call(perLanguage, full)) {
    return normalizeModelIdList(perLanguage[full]);
  }
  const p = primaryLang(full);
  if (Object.prototype.hasOwnProperty.call(perLanguage, p)) {
    return normalizeModelIdList(perLanguage[p]);
  }
  const samePrimary = Object.keys(perLanguage).filter((k) => primaryLang(k) === p);
  if (samePrimary.length > 0) {
    samePrimary.sort((a, b) => {
      const ra = a.split('-').filter(Boolean).length;
      const rb = b.split('-').filter(Boolean).length;
      if (rb !== ra) return rb - ra;
      return b.length - a.length;
    });
    return normalizeModelIdList(perLanguage[samePrimary[0]]);
  }
  return normalizeModelIdList(nonEnglishAllowedModels);
}

/**
 * Sceglie quale voce `perLanguage` mostrare nell’editor al **primo** caricamento dal file.
 * Preferisce la lingua del catalogo con più `model_id` salvati (es. `it-IT` vs `it`), così al reload
 * non si resta su `it` mentre le ultime modifiche erano su `it-IT`.
 */
export function pickDefaultLocaleForElevenLabsMappingFromFile(
  catalogLocales: string[],
  perLanguage: Record<string, string[]>
): string {
  const keys = catalogLocales.length ? catalogLocales : ['it-IT'];
  const counts = keys.map((k) => ({
    k,
    n: Array.isArray(perLanguage[k]) ? perLanguage[k].length : 0,
  }));
  const maxN = Math.max(0, ...counts.map((c) => c.n));
  if (maxN === 0) return keys[0];

  const rank = (s: string) => s.split('-').filter(Boolean).length;
  const top = counts.filter((c) => c.n === maxN);
  top.sort((a, b) => {
    if (rank(b.k) !== rank(a.k)) return rank(b.k) - rank(a.k);
    return b.k.length - a.k.length;
  });
  return top[0]?.k ?? keys[0];
}

export type CatalogLocaleRow = { locale: string; label: string };

/**
 * Unisce lingue non inglesi dal catalogo sync con le chiavi `perLanguage` presenti solo su file.
 * Evita che, dopo riapertura, la UI mostri solo lingue catalogo (es. `it`) ignorando mapping salvato
 * su varianti BCP-47 (es. `it-IT`): in quel caso le checkbox sembrano vuote pur avendo salvato.
 */
export function mergeNonEnLocalesFromCatalogAndMapping(
  catalogLocales: CatalogLocaleRow[],
  perLanguage: Record<string, unknown>
): CatalogLocaleRow[] {
  const byLocale = new Map<string, CatalogLocaleRow>();
  for (const row of catalogLocales) {
    const loc = String(row.locale ?? '').trim();
    if (!loc || primaryLang(loc) === 'en') continue;
    const label =
      typeof row.label === 'string' && row.label.trim().length > 0 ? row.label.trim() : loc;
    byLocale.set(loc, { locale: loc, label });
  }
  const per = perLanguage && typeof perLanguage === 'object' && !Array.isArray(perLanguage) ? perLanguage : {};
  for (const k of Object.keys(per)) {
    const loc = k.trim();
    if (!loc || primaryLang(loc) === 'en') continue;
    if (!Array.isArray(per[k])) continue;
    if (!byLocale.has(loc)) {
      byLocale.set(loc, { locale: loc, label: `${loc} · config` });
    }
  }
  if (byLocale.size === 0) {
    return [{ locale: 'it-IT', label: 'Italiano (it-IT)' }];
  }
  return [...byLocale.values()].sort((a, b) =>
    a.locale.localeCompare(b.locale, undefined, { sensitivity: 'base' })
  );
}
