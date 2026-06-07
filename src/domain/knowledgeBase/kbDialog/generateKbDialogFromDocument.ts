/**
 * Entry point: genera UC dialogo KB da documento staged approvato.
 */

import type { StagedKbDocument } from '../kbDocumentTypes';
import { extractRestructuredDataForRuntime } from '../kbDocumentRestructureSplit';
import { parseMarkdownPipeTable } from '../parseKbTabularText';
import { kbDocumentHasUsableRestructure } from '../kbDocumentRestructureHelpers';
import { generateKbDialogUseCases } from './kbDialogUseCaseGeneration';
import type { GenerateKbDialogUseCasesResult } from './kbDialogTypes';

export type GenerateKbDialogFromDocumentResult =
  | { ok: true; result: GenerateKbDialogUseCasesResult; updatedSelectorSpec: StagedKbDocument['documentSelectorSpec'] }
  | { ok: false; error: string };

/** Genera UC + runtime index dal primo documento KB dialog-ready. */
export function generateKbDialogUseCasesFromDocument(
  doc: StagedKbDocument
): GenerateKbDialogFromDocumentResult {
  if (!doc.documentRestructuredApprovedForRuntime) {
    return { ok: false, error: 'kb_not_approved' };
  }
  if (!kbDocumentHasUsableRestructure(doc)) {
    return { ok: false, error: 'kb_restructure_missing' };
  }
  if (!doc.documentSelectorSpec?.columns?.length) {
    return { ok: false, error: 'kb_selector_spec_missing' };
  }

  const md = extractRestructuredDataForRuntime(String(doc.documentRestructuredMarkdown ?? ''));
  const parsed = parseMarkdownPipeTable(md);
  if (!parsed || parsed.grid.headers.length === 0) {
    return { ok: false, error: 'kb_table_parse_failed' };
  }

  const result = generateKbDialogUseCases({
    grid: parsed.grid,
    selectorSpec: doc.documentSelectorSpec,
    kbDocumentId: doc.id,
  });

  const updatedSelectorSpec = {
    ...doc.documentSelectorSpec,
    valueLabels: result.valueLabels,
    completeTemplate: result.completeTemplate,
  };

  return { ok: true, result, updatedSelectorSpec };
}
