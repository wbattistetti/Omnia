/**

 * Baseline per sezione Monaco (post-proposta / struttura agente).

 */



import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';

import {

  howToUseSectionId,

  paramDetailSectionId,

  proposedBackendSectionId,

} from './backendAnalysisSectionIds';



/** Snapshot testi stabilizzati per diff arancione e revisione. */

export function buildSectionBaselinesFromDocument(

  doc: BackendAnalysisDocumentV2

): Record<string, string> {

  const baselines: Record<string, string> = {

    agentSystemPrompt: doc.global.agentSystemPromptMarkdown,

  };



  for (const p of doc.global.proposedBackends) {

    baselines[proposedBackendSectionId(p.id)] =
      p.purposeMarkdown.trim() || p.specMarkdown;

  }



  for (const backend of Object.values(doc.backends)) {

    baselines[howToUseSectionId(backend.catalogEntryId)] = backend.howToUseMarkdown;

    for (const param of Object.values(backend.parameters)) {

      baselines[paramDetailSectionId(backend.catalogEntryId, param.paramKey)] =

        param.analysisDetailMarkdown;

    }

  }



  return baselines;

}


