/**
 * Applica le bozze sezione Monaco (howToUse / paramDetail) al documento V2 senza toccare il catalogo progetto a ogni keystroke.
 */

import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';
import { sectionIdBelongsToCatalogEntry } from './backendAnalysisSectionIds';

/** Unisce le bozze edit delle sezioni di un backend nel documento analisi. */
export function applyCatalogSectionDraftsToDocument(
  doc: BackendAnalysisDocumentV2,
  catalogEntryId: string,
  sectionDrafts: Record<string, string>
): BackendAnalysisDocumentV2 {
  const backend = doc.backends[catalogEntryId];
  if (!backend) return doc;

  let howToUseMarkdown = backend.howToUseMarkdown;
  const parameters = { ...backend.parameters };
  let changed = false;

  const howToId = `howToUse:${catalogEntryId}`;
  const howToDraft = sectionDrafts[howToId];
  if (howToDraft !== undefined && howToDraft !== howToUseMarkdown) {
    howToUseMarkdown = howToDraft;
    changed = true;
  }

  const paramPrefix = `paramDetail:${catalogEntryId}:`;
  for (const [sectionId, draft] of Object.entries(sectionDrafts)) {
    if (!sectionId.startsWith(paramPrefix)) continue;
    const paramKey = sectionId.slice(paramPrefix.length);
    const prev = parameters[paramKey];
    if (!prev || prev.analysisDetailMarkdown === draft) continue;
    parameters[paramKey] = { ...prev, analysisDetailMarkdown: draft };
    changed = true;
  }

  if (!changed) return doc;

  return {
    ...doc,
    backends: {
      ...doc.backends,
      [catalogEntryId]: {
        ...backend,
        howToUseMarkdown,
        parameters,
      },
    },
  };
}

export function clearCatalogEntrySectionDrafts(
  drafts: Record<string, string>,
  catalogEntryId: string
): Record<string, string> {
  const next = { ...drafts };
  for (const sid of Object.keys(next)) {
    if (sectionIdBelongsToCatalogEntry(sid, catalogEntryId)) {
      delete next[sid];
    }
  }
  return next;
}
