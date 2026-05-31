/**

 * Testo KB da inviare a ElevenLabs `knowledge-base/text` e sezione prompt sync.

 * Allineato al generatore use case: analisi distillata, markdown locale, fetch repository.

 */



import { resolveKbRuntimeDistillTextSync } from '@domain/analysisRuntime/analysisRuntimeDistill';

import { kbDocumentHasUsableAnalysis } from '@domain/knowledgeBase/kbAnalysisRuntimeSynthesis';

import type { StagedKbDocument } from '@domain/knowledgeBase/kbDocumentTypes';

import {

  isInvalidationKbDocument,

  kbDocumentsEligibleForUseCaseContext,

} from '@domain/knowledgeBase/useCaseInvalidationKb';

import { kbRepositoryKeyForDoc } from '@domain/knowledgeBase/kbRepositoryContract';
import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';



export const MAX_KB_UPLOAD_CHARS = 48_000;



function clipKbText(text: string): string {

  const t = text.trim();

  if (!t) return '';

  return t.length > MAX_KB_UPLOAD_CHARS ? `${t.slice(0, MAX_KB_UPLOAD_CHARS)}…` : t;

}



function stagedFieldsTextForConvaiUpload(doc: StagedKbDocument): string | null {

  const snippet = String(doc.markdownSnippet ?? '').trim();

  if (snippet.length >= 80) return clipKbText(snippet);



  const howTo = String(doc.howToUseText ?? '').trim();

  const vars = doc.variables?.length

    ? doc.variables

        .slice(0, 40)

        .map((v) => `- ${v.internalName} (${v.sourceColumn})`)

        .join('\n')

    : '';

  const parts = [howTo, vars ? `### Variabili estratte\n${vars}` : ''].filter(Boolean);

  const joined = parts.join('\n\n').trim();

  return joined.length >= 40 ? clipKbText(joined) : null;

}



/** Testo non vuoto da campi staged (sync, senza rete). */

export function resolveKbTextForConvaiUpload(doc: StagedKbDocument): string | null {

  const raw = String(doc.documentAnalysisMarkdown ?? '').trim();

  if (kbDocumentHasUsableAnalysis(doc)) {

    const text = resolveKbRuntimeDistillTextSync(doc, MAX_KB_UPLOAD_CHARS).trim();

    if (text) return text;

  }

  if (raw.length >= 80) return clipKbText(raw);



  if (isInvalidationKbDocument(doc)) {

    return raw.length > 0 ? clipKbText(raw) : null;

  }



  return stagedFieldsTextForConvaiUpload(doc);

}



/**

 * Risolve testo KB per upload ElevenLabs: staged → fetch repository (come use case generator).

 */

export async function resolveKbTextForConvaiUploadAsync(

  doc: StagedKbDocument,

  projectId: string | undefined

): Promise<string | null> {

  const local = resolveKbTextForConvaiUpload(doc);

  if (local) return local;



  if (isInvalidationKbDocument(doc)) return null;



  const pid = String(projectId ?? '').trim();

  const rid = kbRepositoryKeyForDoc(doc);
  if (!pid || !rid) return null;

  try {
    const hit = await fetchKbDocumentContent(pid, rid, MAX_KB_UPLOAD_CHARS);
    const text = String(hit.text ?? '').trim();
    return text.length > 0 ? clipKbText(text) : null;
  } catch {
    return null;
  }

}



/** Documenti KB candidati all’upload (stesso filtro del generatore use case). */

export function listKbDocumentsForConvaiUpload(

  documents: readonly StagedKbDocument[] | undefined

): StagedKbDocument[] {

  return [...kbDocumentsEligibleForUseCaseContext(documents ?? [])];

}



export type ConvaiKbUploadPlanItem = {

  doc: StagedKbDocument;

  /** True se c’è testo locale; false = serve fetch repository in sync. */

  hasLocalText: boolean;

};



/** Piano upload: tutti i documenti eleggibili + flag testo già in memoria. */

export function planKbDocumentsForConvaiUpload(

  documents: readonly StagedKbDocument[] | undefined

): ConvaiKbUploadPlanItem[] {

  return listKbDocumentsForConvaiUpload(documents).map((doc) => ({

    doc,

    hasLocalText: resolveKbTextForConvaiUpload(doc) != null,

  }));

}


