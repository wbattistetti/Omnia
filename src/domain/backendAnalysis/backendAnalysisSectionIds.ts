/**
 * Identificatori sezioni analisi backend (baseline diff / revisione per Monaco).
 */

import { sanitizeSuggestedBackendName } from './proposedBackendFromAnalysis';

export type BackendAnalysisSectionId =

  | 'agentSystemPrompt'

  | `howToUse:${string}`

  | `proposed:${string}`

  | `paramDetail:${string}:${string}`;



export function howToUseSectionId(catalogEntryId: string): BackendAnalysisSectionId {

  return `howToUse:${catalogEntryId}`;

}



export function proposedBackendSectionId(proposedId: string): BackendAnalysisSectionId {

  return `proposed:${proposedId}`;

}



export function paramDetailSectionId(

  catalogEntryId: string,

  paramKey: string

): BackendAnalysisSectionId {

  return `paramDetail:${catalogEntryId}:${paramKey}`;

}



export function proposedBackendAccordionTitle(suggestedName: string): string {
  const name = sanitizeSuggestedBackendName(suggestedName);
  return `Backend da aggiungere «${name}»?`;
}



export function sectionReviewHeading(sectionId: BackendAnalysisSectionId): string {

  if (sectionId === 'agentSystemPrompt') return '## System prompt per l\'agente';

  if (sectionId.startsWith('howToUse:')) {

    const id = sectionId.slice('howToUse:'.length);

    return `## Come usare il backend ${id}`;

  }

  if (sectionId.startsWith('proposed:')) {

    return `## Backend da aggiungere`;

  }

  if (sectionId.startsWith('paramDetail:')) {

    const rest = sectionId.slice('paramDetail:'.length);

    const sep = rest.indexOf(':');

    const param = sep >= 0 ? rest.slice(sep + 1) : rest;

    return `## Analisi parametro ${param}`;

  }

  return '## Sezione analisi backend';

}


