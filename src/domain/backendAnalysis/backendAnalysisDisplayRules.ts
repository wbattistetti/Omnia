/**
 * Regole visibilità UI analisi backend (niente template vuoti prima della prima analisi).
 */

import type {
  BackendAnalysisBackendRecord,
  BackendAnalysisDocumentV2,
} from './backendAnalysisDocumentV2';
import { isPlaceholderProposedSpec } from './proposedBackendFromAnalysis';
import { proposedBackendHasSubstance } from './proposedBackendSpec';
import {
  suggestedFeatureHasSubstance,
  type BackendSuggestedFeatureRecord,
} from './suggestedFeatureSpec';

export function hasCompletedFirstBackendAnalysis(agentBaselineMarkdown: string): boolean {
  return Boolean(String(agentBaselineMarkdown ?? '').trim());
}

export function backendHowToUseHasContent(backend: BackendAnalysisBackendRecord): boolean {
  return Boolean(backend.howToUseMarkdown.trim());
}

export function backendHasParameterAnalysis(backend: BackendAnalysisBackendRecord): boolean {
  return Object.values(backend.parameters).some(
    (p) =>
      Boolean(p.descriptionShort.trim()) ||
      Boolean(p.role.trim()) ||
      Boolean(p.analysisSummary.trim()) ||
      Boolean(p.analysisDetailMarkdown.trim())
  );
}

export function filterProposedForDisplay(
  proposed: BackendAnalysisDocumentV2['global']['proposedBackends']
): BackendAnalysisDocumentV2['global']['proposedBackends'] {
  return proposed.filter(
    (p) => proposedBackendHasSubstance(p) && !isPlaceholderProposedSpec(p.specMarkdown)
  );
}

export function systemPromptHasContent(doc: BackendAnalysisDocumentV2): boolean {
  return Boolean(doc.global.agentSystemPromptMarkdown.trim());
}

export function filterSuggestedFeaturesForDisplay(
  features: readonly BackendSuggestedFeatureRecord[] | undefined
): BackendSuggestedFeatureRecord[] {
  return (features ?? []).filter((f) => suggestedFeatureHasSubstance(f));
}

export function backendHasSuggestedFeatures(backend: BackendAnalysisBackendRecord): boolean {
  return filterSuggestedFeaturesForDisplay(backend.suggestedFeatures).length > 0;
}
