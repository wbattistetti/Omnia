/**
 * Helper documento KB riformattato: validità e preferenza runtime.
 */

import type { StagedKbDocument } from './kbDocumentTypes';
import { extractRestructuredDataForRuntime } from './kbDocumentRestructureSplit';
import type { KbTabularGrid } from './parseKbTabularText';
import {
  validateSelectorSpecForApproval,
  type SelectorSpecValidationIssue,
} from './kbSelectorSpec';

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

/** Issue bloccanti per approvazione runtime (tabella + selectorSpec). */
export function kbDocumentRestructureApprovalIssues(
  doc: {
    documentRestructuredMarkdown?: string;
    documentSelectorSpec?: StagedKbDocument['documentSelectorSpec'];
  },
  grid?: KbTabularGrid | null
): SelectorSpecValidationIssue[] {
  if (!kbDocumentHasUsableRestructure(doc)) {
    return [{ code: 'unusable_table', message: 'Tabella riformattata non utilizzabile.' }];
  }
  return validateSelectorSpecForApproval(doc.documentSelectorSpec, grid ?? null);
}

/** True se tabella e selectorSpec sono pronti per approvazione runtime. */
export function canApproveKbDocumentRestructureForRuntime(
  doc: {
    documentRestructuredMarkdown?: string;
    documentSelectorSpec?: StagedKbDocument['documentSelectorSpec'];
  },
  grid?: KbTabularGrid | null
): boolean {
  return kbDocumentRestructureApprovalIssues(doc, grid).length === 0;
}
