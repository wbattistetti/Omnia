/**
 * Backend analysis iteration rules — reuses KB observation workflow.
 */

import {
  normalizeAnalysisText,
  shouldRunObservationReview,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

export {
  allReviewItemsConfirmed,
  analysisDraftDiffersFromBaseline,
  countConfirmedReviewItems,
  createReviewSessionItems,
  observationsForFinalize,
  shouldRunObservationReview,
  parseKbAnalysisObservationReview,
  resolveKbAnalysisToolbarPresentation as resolveBackendAnalysisToolbarPresentation,
  resolveSectionEditsToolbarPresentation,
  mergeKbAnalysisToolbarPresentations,
  type KbAnalysisToolbarPresentation,
  type KbAnalysisActionPhase,
  type KbAnalysisObservation,
  type KbAnalysisObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';

/**
 * Routes «Esegui» to observation review only when an agent baseline exists.
 * (Defined here so BackendAnalysisTab does not depend on a fragile re-export at runtime.)
 */
export function shouldKbAnalysisRouteToObservationReview(
  baseline: string,
  draft: string
): boolean {
  if (!normalizeAnalysisText(baseline)) return false;
  return shouldRunObservationReview(baseline, draft);
}
