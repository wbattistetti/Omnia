/**
 * Appends readable KB repository text to the use-case generator userDesc.
 */

import { fetchKbDocumentContent } from '@services/kbDocumentRepositoryApi';
import type { StagedKbDocument } from './kbDocumentTypes';

const KB_SECTION_HEADER = '--- KNOWLEDGE BASE (reference documents) ---';
const TOTAL_KB_CHARS_BUDGET = 80_000;
const PER_DOC_MAX_CHARS = 40_000;

/** Documents uploaded and readable from project repository. */
export function kbDocumentsEligibleForUseCaseContext(
  docs: readonly StagedKbDocument[]
): readonly StagedKbDocument[] {
  return docs.filter(
    (d) => d.parseStatus === 'ready' && Boolean(String(d.repositoryDocumentId ?? '').trim())
  );
}

export type BuildUserDescWithKbResult = {
  userDesc: string;
  kbWarnings: string[];
  kbDocCount: number;
};

/**
 * Fetches each eligible KB doc from the repository and appends markdown/text to baseUserDesc.
 */
export async function buildUserDescWithKnowledgeBaseContext(params: {
  projectId: string | undefined;
  baseUserDesc: string;
  documents: readonly StagedKbDocument[];
}): Promise<BuildUserDescWithKbResult> {
  const base = String(params.baseUserDesc ?? '').trim();
  const pid = String(params.projectId ?? '').trim();
  const eligible = kbDocumentsEligibleForUseCaseContext(params.documents);

  if (!pid || eligible.length === 0) {
    return { userDesc: base, kbWarnings: [], kbDocCount: 0 };
  }

  const warnings: string[] = [];
  const perDocBudget = Math.max(
    4_000,
    Math.min(PER_DOC_MAX_CHARS, Math.floor(TOTAL_KB_CHARS_BUDGET / eligible.length))
  );

  const blocks: string[] = [];
  for (const doc of eligible) {
    const rid = String(doc.repositoryDocumentId ?? '').trim();
    try {
      const hit = await fetchKbDocumentContent(pid, rid, perDocBudget);
      const text = String(hit.text ?? '').trim();
      if (!text) {
        warnings.push(`${doc.name}: contenuto vuoto, ignorato.`);
        continue;
      }
      const truncNote = hit.truncated ? ' [troncato per limite caratteri]' : '';
      blocks.push(`### ${doc.name}${truncNote}\n\n${text}`);
    } catch (err) {
      warnings.push(
        `${doc.name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (blocks.length === 0) {
    return { userDesc: base, kbWarnings: warnings, kbDocCount: 0 };
  }

  const kbBlock = [KB_SECTION_HEADER, ...blocks].join('\n\n');
  const userDesc = base ? `${base}\n\n${kbBlock}` : kbBlock;
  return { userDesc: userDesc.trim(), kbWarnings: warnings, kbDocCount: blocks.length };
}
