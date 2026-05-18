/**
 * Induced rules and chat messages for KB semantic analysis.
 */

export type KbRuleValidation = 'up' | 'down' | null;

export type KbInducedRule = {
  id: string;
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
};

export type KbChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
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
      return {
        id: String(o.id ?? createKbRuleId()).trim() || `rule_${i + 1}`,
        title: title || field || ruleText.slice(0, 72),
        field: field || '—',
        rule: ruleText,
        evidence: String(o.evidence ?? o.evidenza ?? '').trim(),
        note: String(o.note ?? '').trim(),
        included: o.included !== false,
        validation: validation === 'up' || validation === 'down' ? validation : null,
        deleted: o.deleted === true,
      };
    })
    .filter((x): x is KbInducedRule => x !== null);
}
