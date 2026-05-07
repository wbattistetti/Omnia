/**
 * Identificativo deterministico di progetto per scope BookFromAgenda / Redis (design-time).
 * Allineato alla convenzione server VB {@code BookFromAgendaProjectIdUtil.GenerateProjectId}.
 */

export type GenerateProjectIdSegments = {
  cliente: string;
  nomeProgetto: string;
  versione: string;
};

/** Normalizza un segmento per uso in chiave stabile (solo [a-zA-Z0-9_]). */
export function sanitizeProjectIdSegment(raw: string | undefined | null): string {
  const s = String(raw ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'na';
}

/**
 * Restituisce `Omnia_<cliente>_<nomeProgetto>_<versione>` con segmenti sanitizzati.
 */
export function generateProjectId(
  cliente: string | undefined | null,
  nomeProgetto: string | undefined | null,
  versione: string | undefined | null
): string {
  const c = sanitizeProjectIdSegment(cliente);
  const p = sanitizeProjectIdSegment(nomeProgetto);
  const v = sanitizeProjectIdSegment(versione);
  return `Omnia_${c}_${p}_${v}`;
}
