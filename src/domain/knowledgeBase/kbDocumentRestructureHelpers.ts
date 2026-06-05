/**
 * Helper documento KB riformattato: validità e preferenza runtime.
 */

import type { StagedKbDocument } from './kbDocumentTypes';
import { extractRestructuredDataForRuntime } from './kbDocumentRestructureSplit';

const MIN_USABLE_RESTRUCTURE_CHARS = 80;

/** True se esiste un documento riformattato utilizzabile. */
export function kbDocumentHasUsableRestructure(doc: {
  documentRestructuredMarkdown?: string;
  agentRestructuredBaselineMarkdown?: string;
}): boolean {
  const text = String(doc.documentRestructuredMarkdown ?? '').trim();
  if (text.length < MIN_USABLE_RESTRUCTURE_CHARS) return false;
  if (/(da definire\)|_Nessuna sintesi)/i.test(text) && text.length < 120) return false;
  return true;
}

/** True dopo almeno una «Proponi riformattazione» completata con successo. */
export function kbDocumentRestructureStarted(doc: {
  agentRestructuredBaselineMarkdown?: string;
}): boolean {
  return Boolean(String(doc.agentRestructuredBaselineMarkdown ?? '').trim());
}

/** True se il designer ha approvato il documento riformattato per runtime agente. */
export function kbDocumentRestructureApprovedForRuntime(doc: {
  documentRestructuredApprovedForRuntime?: boolean;
}): boolean {
  return doc.documentRestructuredApprovedForRuntime === true;
}

/** Testo riformattato da usare a runtime se approvato e valido. */
export function resolveKbRestructuredRuntimeText(doc: StagedKbDocument): string | null {
  if (!kbDocumentRestructureApprovedForRuntime(doc)) return null;
  if (!kbDocumentHasUsableRestructure(doc)) return null;
  return extractRestructuredDataForRuntime(String(doc.documentRestructuredMarkdown ?? ''));
}
