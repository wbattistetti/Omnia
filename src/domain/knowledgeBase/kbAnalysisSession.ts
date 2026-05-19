/**
 * KB guided analysis session: consent, rule review queue, completion criteria.
 */

import { buildKbHypothesisChoiceMessages } from './kbChatInteractive';
import { isKbMacroRule, pickNextReviewRuleIdHierarchical } from './kbRuleHierarchy';
import {
  isKbRuleStatusClosed,
  isKbRuleStatusPromotable,
  ruleIncludedDefaultForStatus,
} from './kbRuleStatus';
import type { KbInducedRule, KbRuleConfidence, KbRuleStatus } from './kbRuleTypes';
import type { StagedKbDocument } from './kbDocumentTypes';
import { createKbChatMessageId } from './kbRuleTypes';
import type { KbChatMessage } from './kbRuleTypes';

export type KbAnalysisPhase =
  | 'idle'
  | 'awaiting_hypothesis_choice'
  | 'awaiting_hypothesis_input'
  | 'phase_a'
  | 'phase_b'
  | 'phase_c'
  | 'complete';

export type KbPromotionStatus = 'idle' | 'pending' | 'ok' | 'partial' | 'failed';

/** @deprecated Use hypothesis choice flow */
export const KB_CONSENT_MESSAGE =
  'Vuoi che analizziamo questo documento per individuare i casi d\'uso specifici che emergono dal suo contenuto, in relazione al task dell\'agente?';

export function isKbRuleReviewClosed(status: KbRuleStatus): boolean {
  return isKbRuleStatusClosed(status);
}

export function isKbDocumentIngestReady(doc: StagedKbDocument): boolean {
  return (
    doc.parseStatus === 'ready' &&
    Boolean(doc.repositoryDocumentId?.trim()) &&
    doc.parseStatus !== 'parsing'
  );
}

/** Visible rules for review (not soft-deleted). */
export function kbVisibleRules(rules: readonly KbInducedRule[]): KbInducedRule[] {
  return rules.filter((r) => !r.deleted);
}

export function pickNextReviewRuleId(
  rules: readonly KbInducedRule[],
  currentRuleId: string | null | undefined
): string | null {
  return pickNextReviewRuleIdHierarchical(rules, currentRuleId);
}

export function countOpenRules(rules: readonly KbInducedRule[]): number {
  return kbVisibleRules(rules).filter((r) => !isKbRuleReviewClosed(r.status)).length;
}

export function areAllKbRulesResolved(rules: readonly KbInducedRule[]): boolean {
  const visible = kbVisibleRules(rules);
  if (visible.length === 0) return true;
  return visible.every((r) => isKbRuleReviewClosed(r.status));
}

export function canPromoteRule(rule: KbInducedRule): boolean {
  if (rule.deleted || !isKbRuleStatusPromotable(rule.status)) return false;
  if (isKbMacroRule(rule)) return false;
  return rule.included !== false;
}

/** Auto-promote batch: only high-confidence open rules. */
export function canAutoConfirmRule(rule: KbInducedRule): boolean {
  return !rule.deleted && rule.confidence === 'high' && !isKbRuleReviewClosed(rule.status);
}

export function rulesEligibleForPromotion(rules: readonly KbInducedRule[]): KbInducedRule[] {
  return kbVisibleRules(rules).filter(canPromoteRule);
}

export function computeKbAnalysisComplete(doc: {
  rules: readonly KbInducedRule[];
  promotedDraftCount: number;
  designerSignOffNoUseCases?: boolean;
  noActionableRules?: boolean;
}): boolean {
  if (doc.designerSignOffNoUseCases) return true;
  if (!areAllKbRulesResolved(doc.rules)) return false;
  if (doc.noActionableRules) return true;
  return doc.promotedDraftCount >= 1;
}

/** Close open rules as skipped when designer signs off with no use cases. */
export function skipAllOpenKbRules(rules: readonly KbInducedRule[]): KbInducedRule[] {
  const now = new Date().toISOString();
  return rules.map((r) => {
    if (r.deleted || isKbRuleReviewClosed(r.status)) return r;
    return {
      ...r,
      status: 'invalid' as const,
      included: false,
      reviewedAt: now,
    };
  });
}

export function countDeferredOpenRules(rules: readonly KbInducedRule[]): number {
  return kbVisibleRules(rules).filter((r) => r.status === 'corrected').length;
}

export function buildKbConsentChatMessages(): KbChatMessage[] {
  return buildKbHypothesisChoiceMessages();
}

export function formatRuleReviewPrompt(rule: KbInducedRule): string {
  const title = rule.title || rule.field || 'Regola';
  const parts = [
    `Ho trovato questa regola: **${title}**.`,
    rule.fallback ? `Fallback: ${rule.fallback}` : null,
    rule.rule && rule.rule !== '—' ? rule.rule : null,
  ].filter(Boolean);
  const body = parts.length > 1 ? parts.join(' ') : parts[0] ?? title;
  return `${body} Potrebbe avere senso come caso d'uso. Cosa ne pensi?`;
}

export function patchRuleStatus(
  rules: readonly KbInducedRule[],
  ruleId: string,
  status: KbRuleStatus
): KbInducedRule[] {
  const now = new Date().toISOString();
  return rules.map((r) =>
    r.id === ruleId
      ? {
          ...r,
          status,
          reviewedAt: now,
          ...(status === 'invalid' ? { included: false } : {}),
        }
      : r
  );
}

export function confirmAllHighConfidenceRules(
  rules: readonly KbInducedRule[]
): KbInducedRule[] {
  const now = new Date().toISOString();
  return rules.map((r) => {
    if (r.deleted || !canAutoConfirmRule(r)) {
      return r;
    }
    return {
      ...r,
      status: 'validated' as const,
      included: true,
      reviewedAt: now,
    };
  });
}

export function patchKbConsentIfReady(doc: StagedKbDocument): StagedKbDocument {
  if (!isKbDocumentIngestReady(doc)) return doc;
  if (doc.consentGiven || doc.analysisPhase !== 'idle') return doc;
  if (doc.chatStarted && doc.rules.length > 0) {
    return {
      ...doc,
      analysisPhase: doc.analysisPhase === 'idle' ? 'phase_b' : doc.analysisPhase,
    };
  }
  if (doc.chatMessages.length > 0 && doc.analysisPhase === 'awaiting_hypothesis_choice') {
    return doc;
  }
  return {
    ...doc,
    analysisPhase: 'awaiting_hypothesis_choice',
    chatMessages: buildKbHypothesisChoiceMessages(),
    chatStarted: true,
  };
}

/** Merge patch and recompute `kbAnalysisComplete` / phase flags. */
export function mergeKbDocumentPatch(
  doc: StagedKbDocument,
  patch: Partial<StagedKbDocument>
): StagedKbDocument {
  const rules = patch.rules ?? doc.rules;
  const promotedDrafts = patch.promotedDrafts ?? doc.promotedDrafts;
  const kbAnalysisComplete = computeKbAnalysisComplete({
    rules,
    promotedDraftCount: promotedDrafts.length,
    designerSignOffNoUseCases:
      patch.designerSignOffNoUseCases ?? doc.designerSignOffNoUseCases,
    noActionableRules: patch.noActionableRules ?? doc.noActionableRules,
  });
  const analysisPhase =
    patch.analysisPhase ??
    (kbAnalysisComplete
      ? 'complete'
      : doc.analysisPhase === 'complete'
        ? 'complete'
        : doc.analysisPhase);
  return {
    ...doc,
    ...patch,
    kbAnalysisComplete,
    analysisPhase: kbAnalysisComplete ? 'complete' : analysisPhase,
  };
}

/**
 * When the user selects a document, align chat/consent UI with persisted analysis state.
 * Returns a patch to apply, or null if already in sync.
 */
export function kbDocumentPatchOnSelect(doc: StagedKbDocument): Partial<StagedKbDocument> | null {
  const afterConsent = patchKbConsentIfReady(doc);
  if (afterConsent !== doc) {
    return {
      analysisPhase: afterConsent.analysisPhase,
      chatMessages: afterConsent.chatMessages,
      chatStarted: afterConsent.chatStarted,
    };
  }
  if (!isKbDocumentIngestReady(doc)) return null;
  if (
    doc.analysisPhase === 'idle' &&
    (doc.rules.length > 0 || (doc.chatMessages.length > 0 && doc.consentGiven))
  ) {
    return {
      analysisPhase:
        doc.rules.length > 0 ? inferPhaseAfterAnalyze(doc.rules) : ('phase_b' as const),
      chatStarted: true,
    };
  }
  return null;
}

export function inferPhaseAfterAnalyze(
  rules: readonly KbInducedRule[]
): KbAnalysisPhase {
  return rules.length > 0 ? 'phase_b' : 'complete';
}

export function confidenceBlocksPromotion(confidence: KbRuleConfidence): boolean {
  return confidence === 'medium' || confidence === 'low';
}
