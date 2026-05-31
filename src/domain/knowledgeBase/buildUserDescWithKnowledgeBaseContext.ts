/**

 * Appends KB analysis synthesis (or fallback raw sample) to use-case generator userDesc.

 */



import {

  resolveKbRuntimeDistillText,

  type RuntimeDistillAiParams,

  type RuntimeDistillCallbacks,

} from '@domain/analysisRuntime/analysisRuntimeDistill';

import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';

import type { StagedKbDocument } from './kbDocumentTypes';
import { kbRepositoryKeyForDoc } from './kbRepositoryContract';
import { kbDocumentHasUsableAnalysis } from './kbAnalysisRuntimeSynthesis';

import {

  isInvalidationKbDocument,

  kbDocumentsEligibleForUseCaseContext,

} from './useCaseInvalidationKb';



export { kbDocumentsEligibleForUseCaseContext };



const KB_SECTION_HEADER = '--- KNOWLEDGE BASE (analisi documenti — sintesi) ---';

const TOTAL_KB_CHARS_BUDGET = 80_000;

const PER_DOC_MAX_CHARS = 40_000;



export type BuildUserDescWithKbResult = {

  userDesc: string;

  kbWarnings: string[];

  kbDocCount: number;

  kbLlmDistillCount: number;

};



export type BuildUserDescWithKbParams = {

  projectId: string | undefined;

  baseUserDesc: string;

  documents: readonly StagedKbDocument[];

  runtimeDistill?: RuntimeDistillAiParams;

  runtimeDistillCallbacks?: RuntimeDistillCallbacks;

};



async function resolveUploadDocText(

  doc: StagedKbDocument,

  projectId: string,

  perDocBudget: number,

  runtimeDistill: RuntimeDistillAiParams | undefined,

  callbacks: RuntimeDistillCallbacks | undefined

): Promise<{ text: string; usedAnalysis: boolean; usedLlmDistill: boolean }> {

  if (kbDocumentHasUsableAnalysis(doc)) {

    const resolved = await resolveKbRuntimeDistillText(

      doc,

      perDocBudget,

      runtimeDistill,

      callbacks

    );

    return {

      text: resolved.text,

      usedAnalysis: true,

      usedLlmDistill: resolved.usedLlmDistill,

    };

  }



  const rid = kbRepositoryKeyForDoc(doc);

  const hit = await fetchKbDocumentContent(projectId, rid, perDocBudget);

  const text = String(hit.text ?? '').trim();

  return { text, usedAnalysis: false, usedLlmDistill: false };

}



/**

 * Appends per-doc KB context: preferisce `documentAnalysisMarkdown` (sintesi) se disponibile.

 */

export async function buildUserDescWithKnowledgeBaseContext(

  params: BuildUserDescWithKbParams

): Promise<BuildUserDescWithKbResult> {

  const base = String(params.baseUserDesc ?? '').trim();

  const pid = String(params.projectId ?? '').trim();

  const eligible = kbDocumentsEligibleForUseCaseContext(params.documents);



  if (eligible.length === 0) {

    return { userDesc: base, kbWarnings: [], kbDocCount: 0, kbLlmDistillCount: 0 };

  }



  const warnings: string[] = [];

  let kbLlmDistillCount = 0;

  const perDocBudget = Math.max(

    4_000,

    Math.min(PER_DOC_MAX_CHARS, Math.floor(TOTAL_KB_CHARS_BUDGET / eligible.length))

  );



  const blocks: string[] = [];

  for (const doc of eligible) {

    if (isInvalidationKbDocument(doc)) {

      const resolved = await resolveKbRuntimeDistillText(

        doc,

        perDocBudget,

        params.runtimeDistill,

        params.runtimeDistillCallbacks

      );

      if (!resolved.text) {

        warnings.push(`${doc.name}: contenuto vuoto, ignorato.`);

        continue;

      }

      if (resolved.usedLlmDistill) kbLlmDistillCount++;

      blocks.push(`### ${doc.name}\n\n${resolved.text}`);

      continue;

    }



    if (!pid) {

      warnings.push(`${doc.name}: progetto non disponibile, ignorato.`);

      continue;

    }



    const rid = String(doc.repositoryDocumentId ?? '').trim();

    if (!rid) {

      warnings.push(`${doc.name}: repository non disponibile, ignorato.`);

      continue;

    }



    try {

      const { text, usedAnalysis, usedLlmDistill } = await resolveUploadDocText(

        doc,

        pid,

        perDocBudget,

        params.runtimeDistill,

        params.runtimeDistillCallbacks

      );

      if (!text) {

        warnings.push(`${doc.name}: contenuto vuoto, ignorato.`);

        continue;

      }

      if (usedLlmDistill) kbLlmDistillCount++;

      const sourceNote = usedAnalysis

        ? usedLlmDistill

          ? ' [sintesi analisi — distillazione LLM]'

          : ' [sintesi analisi documento]'

        : ' [testo grezzo — completa analisi del documento per sintesi]';

      blocks.push(`### ${doc.name}${sourceNote}\n\n${text}`);

      if (!usedAnalysis) {

        warnings.push(

          `${doc.name}: analisi non concordata; usato campione grezzo dal repository.`

        );

      }

    } catch (err) {

      warnings.push(

        `${doc.name}: ${err instanceof Error ? err.message : String(err)}`

      );

    }

  }



  if (blocks.length === 0) {

    return { userDesc: base, kbWarnings: warnings, kbDocCount: 0, kbLlmDistillCount: 0 };

  }



  const kbBlock = [KB_SECTION_HEADER, ...blocks].join('\n\n');

  const userDesc = base ? `${base}\n\n${kbBlock}` : kbBlock;

  return {

    userDesc: userDesc.trim(),

    kbWarnings: warnings,

    kbDocCount: blocks.length,

    kbLlmDistillCount,

  };

}


