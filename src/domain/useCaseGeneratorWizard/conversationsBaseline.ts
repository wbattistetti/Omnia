/**
 * Passo «Conversazioni» (passo 2 wizard): confronto bubble agente vs baseline AI di quella conversazione,
 * con normalizzazione spazi/newline (stessa policy di {@link examplePhraseStyleDiff}).
 *
 * Concetti:
 * - Chiave bubble agente = `${conversationId}::${turnId}`.
 * - "Modified" = la stringa normalizzata corrente differisce dalla baseline AI dell'ultima generazione.
 * - L'aggiunta/rimozione di turni o l'edit delle bubble user NON conta (sono interventi editoriali,
 *   non semantici). Quindi solo i `role === 'agent'` esistenti in entrambe le mappe partecipano al diff.
 * - Le bubble con `suggestion.status === 'rejected'` sono escluse a monte: scartate dal designer,
 *   non rientrano nei piani di proofread né di propagazione stile.
 *
 * Allineato (per shape) a {@link ExamplePhraseStylePlan} del passo 1 per riusare lo stesso pattern UI
 * («se almeno una è modificata e almeno un target esiste, mostra la CTA»).
 */

import { normalizeExamplePhraseForDiff } from './examplePhraseStyleDiff';
import { isSuggestedUseCaseId } from './types';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardTurnAgent,
} from './types';

/** Chiave deterministica per indicizzare la baseline assistente di una bubble. */
export function conversationAgentTurnKey(conversationId: string, turnId: string): string {
  return `${conversationId}::${turnId}`;
}

/**
 * True se la bubble agente è considerata «attiva» nei piani di diff (rejected → esclusa).
 * Le bubble con use case emergente in stato `rejected` sono visivamente presenti ma operativamente
 * fuori dalla revisione: non vengono diffate, non vengono rielaborate, non concorrono alla propagazione.
 */
function isActiveAgentTurnForPlans(turn: UseCaseGeneratorWizardTurnAgent): boolean {
  return turn.suggestion?.status !== 'rejected';
}

/**
 * Snapshot delle sole bubble agente per tutte le conversazioni (testo normalizzato non viene applicato:
 * la baseline conserva la formattazione originale dell'AI, la normalizzazione avviene solo nel diff).
 *
 * Le bubble `rejected` sono incluse comunque nella baseline per non perdere lo snapshot originale;
 * il diff/style plan si occupa di filtrarle a valle.
 */
export function snapshotConversationAgentTurns(
  conversations: readonly UseCaseGeneratorWizardConversation[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const conv of conversations) {
    for (const t of conv.turns) {
      if (t.role !== 'agent') continue;
      out[conversationAgentTurnKey(conv.conversationId, t.turnId)] = t.text;
    }
  }
  return out;
}

/**
 * Snapshot mirato di un sottoinsieme di bubble agente (per aggiornare la baseline solo delle
 * bubble propagate dopo un edit di canonical, senza toccare le altre).
 */
export function snapshotConversationAgentTurnsForKeys(
  conversations: readonly UseCaseGeneratorWizardConversation[],
  baseline: Readonly<Record<string, string>>,
  keysToRefresh: ReadonlySet<string>
): Record<string, string> {
  const next: Record<string, string> = { ...baseline };
  for (const conv of conversations) {
    for (const t of conv.turns) {
      if (t.role !== 'agent') continue;
      const key = conversationAgentTurnKey(conv.conversationId, t.turnId);
      if (!keysToRefresh.has(key)) continue;
      next[key] = t.text;
    }
  }
  return next;
}

export interface ConversationStylePlan {
  /** Chiavi `conversationId::turnId` con testo diverso dalla baseline. */
  modifiedAgentTurnKeys: string[];
  /** Sottoinsieme delle modified raggruppato per conversation (utile per UI / chiamate AI per conversazione). */
  modifiedByConversation: Record<string, string[]>;
  /** Stessa lista in forma di triple risolte (per chiamata backend con context). */
  modifiedAgentTurns: Array<{
    conversationId: string;
    turnId: string;
    useCaseId: string;
    currentText: string;
    baselineText: string;
  }>;
  /**
   * Chiavi `conversationId::turnId` con testo ancora alla baseline AI, raggruppate per conversation.
   * Target candidate per la propagazione di stile (riscrittura su nuovo stile inferito dalle modificate).
   * Escluse: bubble user, suggestion=rejected.
   */
  unmodifiedByConversation: Record<string, string[]>;
  /** Mostra la CTA «Correggi ortografia frasi modificate» quando almeno una bubble è modificata. */
  showProofreadCta: boolean;
  /**
   * Mostra la CTA «Propaga stile alle altre bubble» quando almeno una bubble è modificata
   * E almeno una bubble della stessa conversazione è ancora alla baseline AI.
   * Pattern allineato a {@link ExamplePhraseStylePlan.showStyleCta}.
   */
  showStyleCta: boolean;
  /** Alias deprecato di {@link showProofreadCta} — preservato per gradiente UI già montata. */
  showHomogenizeCta: boolean;
}

/**
 * Confronta lo stato corrente delle conversazioni con la baseline catturata al termine dell'ultima
 * generazione AI. Una chiave assente dalla baseline è considerata "non modificata vs se stessa"
 * (analogamente a {@link computeExamplePhraseStylePlan}).
 */
export function computeConversationStylePlan(
  conversations: readonly UseCaseGeneratorWizardConversation[],
  baselineByKey: Readonly<Record<string, string>>
): ConversationStylePlan {
  const modifiedAgentTurnKeys: string[] = [];
  const modifiedByConversation: Record<string, string[]> = {};
  const unmodifiedByConversation: Record<string, string[]> = {};
  const modifiedAgentTurns: ConversationStylePlan['modifiedAgentTurns'] = [];

  for (const conv of conversations) {
    for (const t of conv.turns) {
      if (t.role !== 'agent') continue;
      const agent = t as UseCaseGeneratorWizardTurnAgent;
      if (!isActiveAgentTurnForPlans(agent)) continue;
      const key = conversationAgentTurnKey(conv.conversationId, agent.turnId);
      const baseRaw = baselineByKey[key];
      if (baseRaw === undefined) continue;
      const cur = normalizeExamplePhraseForDiff(agent.text);
      const base = normalizeExamplePhraseForDiff(baseRaw);
      if (cur === base) {
        const bucket = unmodifiedByConversation[conv.conversationId] ?? [];
        bucket.push(agent.turnId);
        unmodifiedByConversation[conv.conversationId] = bucket;
        continue;
      }
      modifiedAgentTurnKeys.push(key);
      const bucket = modifiedByConversation[conv.conversationId] ?? [];
      bucket.push(agent.turnId);
      modifiedByConversation[conv.conversationId] = bucket;
      modifiedAgentTurns.push({
        conversationId: conv.conversationId,
        turnId: agent.turnId,
        useCaseId: agent.useCaseId,
        currentText: agent.text,
        baselineText: baseRaw,
      });
    }
  }

  const showProofreadCta = modifiedAgentTurnKeys.length > 0;
  const showStyleCta =
    modifiedAgentTurnKeys.length > 0 &&
    Object.entries(unmodifiedByConversation).some(([convId, ids]) => {
      if (ids.length === 0) return false;
      return (modifiedByConversation[convId]?.length ?? 0) > 0;
    });

  return {
    modifiedAgentTurnKeys,
    modifiedByConversation,
    modifiedAgentTurns,
    unmodifiedByConversation,
    showProofreadCta,
    showStyleCta,
    showHomogenizeCta: showProofreadCta,
  };
}

/**
 * Indicizza per `useCaseId` reale (non `suggested:*`) tutte le chiavi bubble agente esistenti.
 * Utile per propagare l'edit di una bubble a tutte le bubble del medesimo use case canonico.
 */
export function indexAgentTurnKeysByUseCaseId(
  conversations: readonly UseCaseGeneratorWizardConversation[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const conv of conversations) {
    for (const t of conv.turns) {
      if (t.role !== 'agent') continue;
      const agent = t as UseCaseGeneratorWizardTurnAgent;
      if (isSuggestedUseCaseId(agent.useCaseId)) continue;
      if (agent.suggestion?.status === 'rejected') continue;
      const bucket = out[agent.useCaseId] ?? [];
      bucket.push(conversationAgentTurnKey(conv.conversationId, agent.turnId));
      out[agent.useCaseId] = bucket;
    }
  }
  return out;
}
