/**
 * API pubblica: struttura testo analisi backend → documento + markdown standard.
 */

import { buildBackendAnalysisMarkdown } from './buildBackendAnalysisDocument';
import type {
  BackendAnalysisStructureContext,
  StructureBackendAnalysisInput,
  StructuredBackendAnalysisResult,
} from './backendAnalysisDocumentTypes';

export function structureBackendAnalysis(
  input: StructureBackendAnalysisInput
): StructuredBackendAnalysisResult {
  return buildBackendAnalysisMarkdown(input);
}

export type {
  BackendAnalysisDocument,
  BackendAnalysisBackendSection,
  BackendAnalysisParameterRow,
  BackendAnalysisPayoffEntry,
  BackendAnalysisPayoffDataV1,
  BackendAnalysisStructureContext,
  StructureBackendAnalysisInput,
  StructuredBackendAnalysisResult,
  BackendParameterKind,
  BackendParameterDirection,
} from './backendAnalysisDocumentTypes';

export { parseBackendAnalysisDocument, buildPayoffLookup, payoffLookupKey } from './parseBackendAnalysisDocument';
export { renderBackendAnalysisDocument } from './renderBackendAnalysisDocument';
export { buildBackendAnalysisDocument, buildBackendAnalysisMarkdown } from './buildBackendAnalysisDocument';
