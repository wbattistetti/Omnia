/**
 * Allinea documento analisi backend al catalogo manuale corrente (rimozioni senza salvataggio separato).
 */

import type { ManualCatalogEntry } from '@domain/backendCatalog/catalogTypes';
import type { BackendAnalysisDocumentV2 } from './backendAnalysisDocumentV2';

export function allowedManualCatalogEntryIds(
  manualEntries: readonly ManualCatalogEntry[]
): Set<string> {
  const out = new Set<string>();
  for (const e of manualEntries) {
    const id = String(e.id ?? '').trim();
    if (id) out.add(id);
  }
  return out;
}

function allowedCatalogLabels(manualEntries: readonly ManualCatalogEntry[]): Set<string> {
  const out = new Set<string>();
  for (const e of manualEntries) {
    const label = String(e.label ?? '').trim().toLowerCase();
    const id = String(e.id ?? '').trim().toLowerCase();
    if (label) out.add(label);
    if (id) out.add(id);
  }
  return out;
}

function backendNameInCatalog(
  name: string,
  allowedIds: Set<string>,
  allowedLabels: Set<string>
): boolean {
  const n = name.trim().toLowerCase();
  if (!n) return false;
  if (allowedIds.has(n) || allowedLabels.has(n)) return true;
  for (const label of allowedLabels) {
    if (label.includes(n) || n.includes(label)) return true;
  }
  return false;
}

/** True se il testo globale cita tool/backend non più nel catalogo (`nome` in backtick). */
function globalNoteReferencesRemovedBackends(
  globalNote: string,
  allowedIds: Set<string>,
  allowedLabels: Set<string>
): boolean {
  const g = globalNote.trim();
  if (!g) return false;
  const re = /`([a-zA-Z0-9_.-]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(g)) !== null) {
    const token = m[1] ?? '';
    if (!token) continue;
    if (!backendNameInCatalog(token, allowedIds, allowedLabels)) {
      return true;
    }
  }
  return false;
}

/**
 * Copia del documento con soli backend ancora in `manualEntries`; opzionale filtro Global/Gaps obsoleti.
 */
export function filterBackendAnalysisDocumentToManualCatalog(
  doc: BackendAnalysisDocumentV2,
  manualEntries: readonly ManualCatalogEntry[],
  options?: { omitStaleGlobal?: boolean; omitStaleProposed?: boolean }
): BackendAnalysisDocumentV2 {
  const allowedIds = allowedManualCatalogEntryIds(manualEntries);
  const allowedLabels = allowedCatalogLabels(manualEntries);
  const omitStaleGlobal = options?.omitStaleGlobal !== false;
  const omitStaleProposed = options?.omitStaleProposed !== false;

  const backends: BackendAnalysisDocumentV2['backends'] = {};
  for (const [key, backend] of Object.entries(doc.backends)) {
    const entryId = String(backend.catalogEntryId ?? key).trim();
    if (allowedIds.has(entryId) || allowedIds.has(key)) {
      backends[key] = backend;
    }
  }

  let agentSystemPromptMarkdown = doc.global.agentSystemPromptMarkdown;
  if (
    omitStaleGlobal &&
    globalNoteReferencesRemovedBackends(agentSystemPromptMarkdown, allowedIds, allowedLabels)
  ) {
    agentSystemPromptMarkdown = '';
  }

  let proposedBackends = doc.global.proposedBackends;
  if (omitStaleProposed && proposedBackends.length > 0) {
    proposedBackends = proposedBackends.filter((p) => {
      const name = String(p.suggestedName ?? '').trim();
      if (name && backendNameInCatalog(name, allowedIds, allowedLabels)) return true;
      const blob = `${p.purposeMarkdown ?? ''} ${p.specMarkdown ?? ''}`.toLowerCase();
      for (const label of allowedLabels) {
        if (label && blob.includes(label)) return true;
      }
      return false;
    });
  }

  return {
    ...doc,
    global: {
      ...doc.global,
      agentSystemPromptMarkdown,
      proposedBackends,
    },
    backends,
  };
}

/** Mutazione in-place safe: restituisce documento pruned (nuova copia). */
export function pruneBackendAnalysisDocumentToManualCatalog(
  doc: BackendAnalysisDocumentV2,
  manualEntries: readonly ManualCatalogEntry[]
): BackendAnalysisDocumentV2 {
  return filterBackendAnalysisDocumentToManualCatalog(doc, manualEntries, {
    omitStaleGlobal: true,
    omitStaleProposed: true,
  });
}
