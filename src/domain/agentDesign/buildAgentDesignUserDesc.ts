/**

 * userDesc per generazione use case: task + sintesi KB + sintesi analisi backend.

 */



import type { ProjectBackendCatalogBlob } from '@domain/backendCatalog/catalogTypes';

import {

  resolveBackendRuntimeDistillText,

  type RuntimeDistillAiParams,

  type RuntimeDistillCallbacks,

} from '@domain/analysisRuntime/analysisRuntimeDistill';

import { patchAgentBackendAnalysis } from '@domain/backendAnalysis/agentBackendAnalysisProject';
import type { AgentBackendAnalysisSnapshot } from '@domain/backendAnalysis/backendAnalysisTypes';

import {

  buildUserDescWithKnowledgeBaseContext,

  type BuildUserDescWithKbResult,

} from '@domain/knowledgeBase/buildUserDescWithKnowledgeBaseContext';

import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';



const BACKEND_SECTION_HEADER = '--- ANALISI BACKEND (sintesi per generazione use case) ---';



export type BuildAgentDesignUserDescParams = {

  projectId: string | undefined;

  agentTaskId: string | undefined;

  baseUserDesc: string;

  documents: readonly StagedKbDocument[];

  backendCatalog?: ProjectBackendCatalogBlob;

  runtimeDistill?: RuntimeDistillAiParams;

  runtimeDistillCallbacks?: RuntimeDistillCallbacks;

};



export type BuildAgentDesignUserDescResult = BuildUserDescWithKbResult & {

  backendAnalysisIncluded: boolean;

  backendLlmDistilled: boolean;

  backendCatalogPatch?: ProjectBackendCatalogBlob;

};



/**

 * Impila descrizione task, analisi documenti KB (sintesi + distillazione LLM) e analisi backend.

 */

export async function buildAgentDesignUserDesc(

  params: BuildAgentDesignUserDescParams

): Promise<BuildAgentDesignUserDescResult> {

  const kbCtx = await buildUserDescWithKnowledgeBaseContext({

    projectId: params.projectId,

    baseUserDesc: params.baseUserDesc,

    documents: params.documents,

    runtimeDistill: params.runtimeDistill,

    runtimeDistillCallbacks: params.runtimeDistillCallbacks,

  });



  const agentId = String(params.agentTaskId ?? '').trim();

  if (!agentId || !params.backendCatalog) {

    return { ...kbCtx, backendAnalysisIncluded: false, backendLlmDistilled: false };

  }



  let backendCatalogPatch: ProjectBackendCatalogBlob | undefined;

  const callbacks: RuntimeDistillCallbacks = {

    ...params.runtimeDistillCallbacks,

    applyBackendAnalysisPatch: (patch: Partial<AgentBackendAnalysisSnapshot>) => {

      params.runtimeDistillCallbacks?.applyBackendAnalysisPatch?.(patch);

      backendCatalogPatch = patchAgentBackendAnalysis(

        backendCatalogPatch ?? params.backendCatalog!,

        agentId,

        patch

      );

    },

  };



  const backendResolved = await resolveBackendRuntimeDistillText(

    params.backendCatalog,

    agentId,

    params.runtimeDistill,

    callbacks

  );



  if (!backendResolved.text.trim()) {

    return { ...kbCtx, backendAnalysisIncluded: false, backendLlmDistilled: false };

  }



  const backendNote = backendResolved.usedLlmDistill

    ? ' [distillazione LLM]'

    : '';

  const userDesc = [kbCtx.userDesc, `${BACKEND_SECTION_HEADER}${backendNote}`, backendResolved.text]

    .filter(Boolean)

    .join('\n\n')

    .trim();



  return {

    ...kbCtx,

    userDesc,

    backendAnalysisIncluded: true,

    backendLlmDistilled: backendResolved.usedLlmDistill,

    backendCatalogPatch,

  };

}


