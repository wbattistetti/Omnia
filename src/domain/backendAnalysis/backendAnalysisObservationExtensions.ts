/**
 * Estensioni osservazioni review specifiche per analisi backend (bozza specifica API).
 */

import type { KbAnalysisObservation } from '@domain/knowledgeBase/kbDocumentAnalysisWorkflow';
import {
  materializeSuggestedFeatureFromDraft,
  parseSuggestedFeatureDraft,
  suggestedFeatureDraftHasSubstance,
  type BackendSuggestedFeatureRecord,
  type KbAnalysisSuggestedFeatureDraft,
} from './suggestedFeatureSpec';

export type { KbAnalysisSuggestedFeatureDraft };

export function observationSuggestsApiExtension(observation: KbAnalysisObservation): boolean {
  if (observation.suggestsApiExtension !== true) return false;
  const draft = observation.suggestedFeatureDraft;
  return draft ? suggestedFeatureDraftHasSubstance(draft) : false;
}

export function materializeObservationSuggestedFeature(
  observation: KbAnalysisObservation
): BackendSuggestedFeatureRecord | null {
  const draft = observation.suggestedFeatureDraft;
  if (!draft || !suggestedFeatureDraftHasSubstance(draft)) return null;
  return materializeSuggestedFeatureFromDraft(draft, observation.id);
}

export { parseSuggestedFeatureDraft };
