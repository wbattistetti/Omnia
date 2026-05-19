/**
 * Induced rules and chat messages for KB semantic analysis.
 */

import {
  normalizeKbRuleStatusValue,
  ruleIncludedDefaultForStatus,
  type KbRuleStatus,
} from './kbRuleStatus';

export type { KbRuleStatus } from './kbRuleStatus';
export {
  KB_RULE_STATUS_CYCLE,
  KB_RULE_STATUS_LABEL,
  cycleKbRuleStatus,
  isKbRuleStatusClosed,
  isKbRuleStatusPromotable,
} from './kbRuleStatus';

export type KbRuleValidation = 'up' | 'down' | null;

export type KbRuleConfidence = 'high' | 'medium' | 'low';

export type KbRuleRelevance = 'high' | 'low';

export type KbRuleKind = 'macro' | 'micro' | 'atomic';

export type KbInducedRule = {
  id: string;
  /** macro = pattern; micro = example under macro; atomic = standalone. */
  ruleKind?: KbRuleKind;
  /** Set on micro rules; must reference a macro rule id. */
  parentRuleId?: string | null;
  /** Short accordion header (AI); falls back to field/rule in UI. */
  title: string;
  field: string;
  rule: string;
  evidence: string;
  note: string;
  included: boolean;
  validation: KbRuleValidation;
  /** Soft-delete: hidden from UI and omitted on reanalyze payload. */
  deleted?: boolean;
  status: KbRuleStatus;
  confidence: KbRuleConfidence;
  trigger: string;
  action: string;
  fallback: string;
  relevanceToTask?: KbRuleRelevance;
  reviewedAt?: string;
};

export type KbChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Visual tone in KB chat (working = IA busy, error = failure). */
  tone?: 'normal' | 'working' | 'error';
  /** In-chat buttons / inline inputs (not plain text). */
  interactive?: import('./kbChatInteractive').KbChatInteractive;
};

export type KbSemanticAnalysisStatus = 'idle' | 'analyzing' | 'ready' | 'error';

export type KbDocumentStructure = {
  document_type?: string;
  sections?: unknown[];
  properties?: unknown[];
  rows?: unknown[];
};

export function createKbRuleId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createKbChatMessageId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRuleStatus(raw: unknown, included: boolean): KbRuleStatus {
  return normalizeKbRuleStatusValue(raw, included);
}

function normalizeConfidence(raw: unknown): KbRuleConfidence {
  const c = String(raw ?? '').trim();
  if (c === 'high' || c === 'medium' || c === 'low') return c;
  return 'medium';
}

export function normalizeKbRules(raw: unknown): KbInducedRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r, i) => {
      if (!r || typeof r !== 'object') return null;
      const o = r as Record<string, unknown>;
      const field = String(o.field ?? o.campo ?? '').trim();
      const rule = String(o.rule ?? o.regola ?? '').trim();
      const title = String(o.title ?? o.titolo ?? '').trim();
      if (!field && !rule && !title) return null;
      const validation = o.validation;
      const ruleText = rule || '—';
      const included = o.included !== false;
      const status = normalizeRuleStatus(o.status, included);
      const confidence = normalizeConfidence(o.confidence);
      const rel = String(o.relevanceToTask ?? '').trim();
      const rawKind = String(o.ruleKind ?? o.kind ?? '').trim().toLowerCase();
      const ruleKind: KbRuleKind =
        rawKind === 'macro' || rawKind === 'micro' ? rawKind : 'atomic';
      const parentRuleId =
        ruleKind === 'macro'
          ? null
          : String(o.parentRuleId ?? o.parentId ?? '').trim() || null;
      return {
        id: String(o.id ?? createKbRuleId()).trim() || `rule_${i + 1}`,
        ruleKind,
        parentRuleId,
        title: title || field || ruleText.slice(0, 72),
        field: field || '—',
        rule: ruleText,
        evidence: String(o.evidence ?? o.evidenza ?? '').trim(),
        note: String(o.note ?? '').trim(),
        included:
          o.included === false ? false : ruleIncludedDefaultForStatus(status),
        validation: validation === 'up' || validation === 'down' ? validation : null,
        deleted: o.deleted === true,
        status,
        confidence,
        trigger: String(o.trigger ?? '').trim(),
        action: String(o.action ?? o.azione ?? '').trim(),
        fallback: String(o.fallback ?? '').trim(),
        relevanceToTask: rel === 'high' || rel === 'low' ? rel : undefined,
        reviewedAt:
          typeof o.reviewedAt === 'string' && o.reviewedAt.trim()
            ? o.reviewedAt.trim()
            : undefined,
      };
    })
    .filter((x): x is KbInducedRule => x !== null);
}
