/**
 * Analisi documento KB snella: poche sezioni operative; dati tabellari → tab Riformattato.
 */

import type { KbAnalysisSectionSlice } from './kbDocumentAnalysisSections';

/** Sezioni canoniche del template snello (allineate al prompt backend). */
export const KB_ANALYSIS_LITE_SECTION_HEADINGS = {
  entities: 'Entities',
  outputFlow: 'Output del flow (variabili task)',
  operationalRules: 'Regole operative per l\'agente',
  clarificationQuestions: 'Domande di chiarimento',
} as const;

/** Ordine di visualizzazione preferito (lite prima, legacy dopo). */
export const KB_ANALYSIS_LITE_SECTION_ORDER: readonly string[] = [
  KB_ANALYSIS_LITE_SECTION_HEADINGS.entities,
  KB_ANALYSIS_LITE_SECTION_HEADINGS.outputFlow,
  KB_ANALYSIS_LITE_SECTION_HEADINGS.operationalRules,
  KB_ANALYSIS_LITE_SECTION_HEADINGS.clarificationQuestions,
];

/** Intestazioni del template esteso (retrocompatibilità). */
export const KB_ANALYSIS_LEGACY_SECTION_HEADINGS = new Set([
  'Sinonimi',
  'Regole di dialogo',
  'Regole di disambiguazione',
  'Richiesta dati mancanti',
  'Schema mapping (pattern)',
  'Domande di disambiguazione',
  'Note sulla KB (designer)',
  'Final structured output',
  'Value → Code mapping',
  'Rules',
  'Disambiguation questions',
]);

function normalizeHeading(heading: string): string {
  return heading.trim().toLowerCase();
}

function liteSectionRank(heading: string): number {
  const norm = normalizeHeading(heading);
  const idx = KB_ANALYSIS_LITE_SECTION_ORDER.findIndex(
    (h) => normalizeHeading(h) === norm
  );
  return idx >= 0 ? idx : KB_ANALYSIS_LITE_SECTION_ORDER.length + 1;
}

/** True se il corpo sezione è vuoto o solo placeholder. */
export function isKbAnalysisSectionBodyEmpty(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return true;
  if (/^[-–—]\s*(n\.?\s*a\.?|non applicabile|n\/a|todo|tbd)\.?\s*$/i.test(trimmed)) return true;
  return false;
}

/** Mostra solo sezioni con contenuto reale. */
export function filterNonEmptyKbAnalysisSections(
  sections: readonly KbAnalysisSectionSlice[]
): KbAnalysisSectionSlice[] {
  return sections.filter((s) => !isKbAnalysisSectionBodyEmpty(s.body));
}

/** Ordina: sezioni lite in cima, legacy in coda (ordine stabile). */
export function sortKbAnalysisSectionsForDisplay(
  sections: readonly KbAnalysisSectionSlice[]
): KbAnalysisSectionSlice[] {
  return [...sections].sort((a, b) => {
    const ra = liteSectionRank(a.heading);
    const rb = liteSectionRank(b.heading);
    if (ra !== rb) return ra - rb;
    return a.heading.localeCompare(b.heading, 'it');
  });
}

export function isKbAnalysisLegacySectionHeading(heading: string): boolean {
  const norm = normalizeHeading(heading);
  if (KB_ANALYSIS_LITE_SECTION_ORDER.some((h) => normalizeHeading(h) === norm)) {
    return false;
  }
  return KB_ANALYSIS_LEGACY_SECTION_HEADINGS.has(heading.trim());
}

export type KbDocumentAnalysisType = 'DATA' | 'RULES' | 'MIXED' | 'UNKNOWN';

/** Estrae DATA | RULES | MIXED dal preambolo ## Type: … */
export function parseKbDocumentTypeFromAnalysisPreamble(preamble: string): KbDocumentAnalysisType {
  const m = preamble.match(/^##\s*Type:\s*(DATA|RULES|MIXED)\b/im);
  if (!m) return 'UNKNOWN';
  return m[1] as KbDocumentAnalysisType;
}

export function prepareKbAnalysisSectionsForDisplay(
  sections: readonly KbAnalysisSectionSlice[]
): KbAnalysisSectionSlice[] {
  return sortKbAnalysisSectionsForDisplay(filterNonEmptyKbAnalysisSections(sections));
}

/** Classe Tailwind per titolo accordion (lite vs legacy). */
export function kbAnalysisSectionHeadingToneClass(heading: string): string {
  const norm = normalizeHeading(heading);
  if (norm === normalizeHeading(KB_ANALYSIS_LITE_SECTION_HEADINGS.entities)) {
    return 'text-cyan-300/90';
  }
  if (norm === normalizeHeading(KB_ANALYSIS_LITE_SECTION_HEADINGS.outputFlow)) {
    return 'text-sky-300/90';
  }
  if (norm === normalizeHeading(KB_ANALYSIS_LITE_SECTION_HEADINGS.operationalRules)) {
    return 'text-violet-300/90';
  }
  if (norm === normalizeHeading(KB_ANALYSIS_LITE_SECTION_HEADINGS.clarificationQuestions)) {
    return 'text-emerald-300/90';
  }
  return 'text-amber-300/70';
}

/** Badge opzionale per sezioni legacy ancora visibili. */
export function kbAnalysisSectionDisplayBadge(heading: string): string | undefined {
  return isKbAnalysisLegacySectionHeading(heading) ? 'Legacy' : undefined;
}
