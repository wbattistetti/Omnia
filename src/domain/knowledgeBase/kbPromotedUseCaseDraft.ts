/**
 * Draft use cases promoted from confirmed KB rules; mapped to AIAgentUseCase for the bundle.
 */

import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import type { KbInducedRule } from './kbRuleTypes';
import { attachKbProvenanceToUseCase, collectPromotedRuleIds } from './kbUseCaseProvenance';

export type KbPromotedUseCaseDraft = {
  draftId: string;
  useCaseId: string;
  intent: string;
  trigger: string;
  slots: string[];
  message: string;
  fallback: string;
  linkedRuleIds: string[];
  sourceDocumentId: string;
  promotionState: 'draft' | 'mapped' | 'failed';
  mapError?: string;
};

export function createKbDraftId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `kb_uc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Build drafts from confirmed rules (client-side, no LLM). */
export function buildDraftsFromConfirmedRules(
  rules: readonly KbInducedRule[],
  sourceDocumentId: string
): KbPromotedUseCaseDraft[] {
  return rules
    .filter((r) => !r.deleted && (r.status === 'validated' || r.status === 'reworked'))
    .map((r) => {
      const useCaseId = `kb-${r.id}`;
      const intent = r.title || r.field || r.rule.slice(0, 80);
      return {
        draftId: createKbDraftId(),
        useCaseId,
        intent,
        trigger:
          r.field && r.field !== '—' ? r.field : (r.title || r.rule.slice(0, 120) || '—'),
        slots: r.field && r.field !== '—' ? [r.field] : [],
        message: r.rule.trim() || r.action || '—',
        fallback: r.fallback || 'Chiedi chiarimento o passa a operatore.',
        linkedRuleIds: [r.id],
        sourceDocumentId,
        promotionState: 'draft' as const,
      };
    });
}

/** Map KB drafts into minimal AIAgentUseCase rows for the task bundle. */
export function mapKbDraftsToAgentUseCases(
  drafts: readonly KbPromotedUseCaseDraft[],
  sortOrderStart = 0,
  sourceFileName?: string
): AIAgentUseCase[] {
  return drafts.map((d, i) =>
    attachKbProvenanceToUseCase(
      {
        id: d.useCaseId,
        label: d.intent.slice(0, 64),
        parent_id: null,
        sort_order: sortOrderStart + i,
        refinement_prompt: '',
        payoff: [d.trigger, d.message, d.fallback].filter(Boolean).join(' · '),
        dialogue: [
          {
            turn_id: `${d.useCaseId}-t0`,
            role: 'assistant' as const,
            content: d.message,
            editable: false,
          },
        ],
        notes: {
          behavior: d.intent,
          tone: '',
        },
        bubble_notes: {},
      },
      d,
      sourceFileName
    )
  );
}

/** Rules confirmed but not yet present in prior promotion drafts. */
export function filterRulesNotYetPromoted(
  rules: readonly KbInducedRule[],
  promotedDrafts: readonly KbPromotedUseCaseDraft[]
): KbInducedRule[] {
  const done = collectPromotedRuleIds(promotedDrafts);
  return rules.filter(
    (r) =>
      !r.deleted &&
      (r.status === 'validated' || r.status === 'reworked') &&
      !done.has(r.id)
  );
}

export function normalizeKbPromotedDrafts(raw: unknown): KbPromotedUseCaseDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const draftId = String(o.draftId ?? createKbDraftId()).trim();
      const useCaseId = String(o.useCaseId ?? '').trim();
      if (!useCaseId) return null;
      return {
        draftId,
        useCaseId,
        intent: String(o.intent ?? '').trim(),
        trigger: String(o.trigger ?? '').trim(),
        slots: Array.isArray(o.slots)
          ? o.slots.map((s) => String(s).trim()).filter(Boolean)
          : [],
        message: String(o.message ?? '').trim(),
        fallback: String(o.fallback ?? '').trim(),
        linkedRuleIds: Array.isArray(o.linkedRuleIds)
          ? o.linkedRuleIds.map((id) => String(id).trim()).filter(Boolean)
          : [],
        sourceDocumentId: String(o.sourceDocumentId ?? '').trim(),
        promotionState:
          o.promotionState === 'mapped' || o.promotionState === 'failed'
            ? o.promotionState
            : 'draft',
        mapError: typeof o.mapError === 'string' ? o.mapError : undefined,
      };
    })
    .filter((x): x is KbPromotedUseCaseDraft => x !== null);
}
