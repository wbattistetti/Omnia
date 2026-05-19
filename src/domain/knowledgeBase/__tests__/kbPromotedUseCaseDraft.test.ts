import { describe, expect, it } from 'vitest';
import {
  buildDraftsFromConfirmedRules,
  mapKbDraftsToAgentUseCases,
} from '../kbPromotedUseCaseDraft';
import type { KbInducedRule } from '../kbRuleTypes';

describe('kbPromotedUseCaseDraft', () => {
  it('maps confirmed rules to bundle rows', () => {
    const rules: KbInducedRule[] = [
      {
        id: 'r1',
        title: 'Prenota visita',
        field: 'prestazione',
        rule: 'Se prima visita, chiedi tipo',
        evidence: 'snippet',
        note: '',
        included: true,
        validation: null,
        status: 'validated',
        confidence: 'high',
        trigger: 'utente chiede appuntamento',
        action: 'chiedi prestazione',
        fallback: 'transfer',
      },
    ];
    const drafts = buildDraftsFromConfirmedRules(rules, 'doc-1');
    expect(drafts).toHaveLength(1);
    const ucs = mapKbDraftsToAgentUseCases(drafts, 3);
    expect(ucs[0]?.id).toBe('kb-r1');
    expect(ucs[0]?.sort_order).toBe(3);
    expect(ucs[0]?.dialogue[0]?.role).toBe('assistant');
    expect(ucs[0]?.bubble_notes?.kb_sourceDocumentId).toBe('doc-1');
    expect(ucs[0]?.bubble_notes?.kb_linkedRuleIds).toBe('r1');
  });
});
