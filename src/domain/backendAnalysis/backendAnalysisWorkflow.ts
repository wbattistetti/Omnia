/**
 * Backend analysis iteration rules — reuses KB observation workflow.
 */

export {
  allReviewItemsConfirmed,
  analysisDraftDiffersFromBaseline,
  countConfirmedReviewItems,
  createReviewSessionItems,
  observationsForFinalize,
  shouldRunObservationReview,
  parseKbAnalysisObservationReview,
  resolveKbAnalysisToolbarPresentation as resolveBackendAnalysisToolbarPresentation,
  type KbAnalysisObservation,
  type KbAnalysisObservationReview,
  type KbAnalysisReviewSessionItem,
} from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
