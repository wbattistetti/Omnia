/**
 * Snapshot wizard use case (pipeline + baseline IA + conversazioni passo 2) persistito sul Task —
 * ripresa sessione dopo salvataggio progetto.
 *
 * Storia schema:
 * - v1: pipeline a 5 passi (includeva «Frasi di esempio»).
 * - v2: pipeline a 4 passi (use_case_list, conversations, tokenization, json_generation).
 * - v3: aggiunge persistenza passo conversazioni (array conversazioni + baseline AI per bubble agente +
 *       view selezionata + activeConversationId).
 * - v4: outcome + lampadina (use case emergenti):
 *       - `conversation.outcome` ('positive' | 'negative'), `allowsSuggestedUseCases`;
 *       - `turn.suggestion` per bubble agente con use case emergente (pending/promoted/rejected);
 *       - `conversation.scenarioSummary` (opzionale): 1–2 frasi descrittive dell'arco generate
 *         dall'AI, mostrate in testa al pannello bubble. Aggiunta forward-compat (campo opzionale,
 *         payload pre-summary restano leggibili — il campo resta vuoto).
 *       Schemi precedenti vengono migrati in lettura assegnando default conservativi
 *       (outcome='positive', no suggested).
 *       Nota: in una variante intermedia di v4 venivano persisti anche `pendingConversationOutcome`
 *       e `pendingConversationAllowSuggested` (selezione corrente toolbar). Sono stati eliminati
 *       quando la toolbar Outcome+Lampadina è stata sostituita dai 3 pulsanti contestuali nel
 *       pannello DX: i campi vengono ignorati silenziosamente in lettura per backward-compat.
 * - v5: passo 3 tokenizzazione:
 *       - `tokenizationBaselineByUseCaseId` (opzionale): mappa `useCaseId → assistant_example_tokenized`
 *         con il valore prodotto dall'ultima generazione AI. Serve a derivare «edit manuale ≥ 1»
 *         rispetto alla baseline AI e abilitare l'avanzamento diretto al passo successivo
 *         (vedi pattern del passo 1 con `examplePhraseBaselineById`).
 *       I payload v4 restano leggibili: il campo è opzionale e default `undefined`.
 * - v6: pipeline ridotta da 4 a 3 passi (rimosso `json_generation`):
 *       - i `stepIndex`/`unlockedMaxStepIndex` persistiti su v2..v5 ammettevano valori fino a 3
 *         (json). In lettura li clampiamo a 2 (tokenization = ultimo step). Il prompt
 *         conversazionale è ora generato on-demand via pulsante toolbar, non come step esplicito.
 *       - rimosso `conversationsView` dall'output (la toolbar Passo 2 ha una vista unica
 *         «conversazioni»; il toggle «usecases» è stato eliminato). Il parser tollera ancora
 *         il campo in input per backward-compat sui payload v3..v5 ma non lo riemette.
 */

import { USE_CASE_GENERATOR_WIZARD_STEP_ORDER } from './registry';
import type {
  UseCaseGeneratorWizardConversation,
  UseCaseGeneratorWizardConversationOutcome,
  UseCaseGeneratorWizardTurn,
  UseCaseGeneratorWizardTurnAgent,
  UseCaseGeneratorWizardTurnSuggestion,
  UseCaseGeneratorWizardTurnSuggestionStatus,
  UseCaseGeneratorWizardTurnUser,
} from './types';

const WIZARD_MAX_STEP_INDEX = USE_CASE_GENERATOR_WIZARD_STEP_ORDER.length - 1;

/** Persistenza corrente (wizard a 3 passi, conversazioni v4 + tokenizzazione v5 + pipeline v6). */
export const USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION = 6 as const;

export interface UseCaseWizardPersistedStateV1 {
  schemaVersion: typeof USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION;
  enabled?: boolean;
  stepIndex: number;
  unlockedMaxStepIndex?: number;
  /** Serializzazione lista use case per confronto dirty passo 1 (`serializeUseCaseListForWizardBaseline`). */
  useCaseListBaseline?: string;
  /** Baseline testo assistente per confronto stile / omogeneizzazione (passo lista). */
  examplePhraseBaselineById?: Record<string, string>;
  /** Passo 2: conversazioni montate dall'AI (e poi editate dal designer). */
  conversations?: UseCaseGeneratorWizardConversation[];
  /** Passo 2: id conversazione attiva nei tab di Riga 3 (può essere null subito dopo cancellazione). */
  activeConversationId?: string | null;
  /** Passo 2: baseline AI per bubble agente — chiave `${conversationId}::${turnId}`. */
  conversationAgentBaselineByKey?: Record<string, string>;
  /**
   * Passo 3 «Tokenizzazione»: baseline AI per il diff `≥ 1 edit manuale`. Mappa
   * `useCaseId → assistant_example_tokenized` come prodotto dall'ultima generazione AI.
   * Se vuota / assente, il wizard considera l'avanzamento «senza edit».
   */
  tokenizationBaselineByUseCaseId?: Record<string, string>;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function clampWizardIndices(
  stepIndex: number,
  unlockedMaxStepIndex: number
): { stepIndex: number; unlockedMaxStepIndex: number } {
  let si = Math.min(Math.max(0, Math.floor(stepIndex)), WIZARD_MAX_STEP_INDEX);
  let um = Math.min(Math.max(0, Math.floor(unlockedMaxStepIndex)), WIZARD_MAX_STEP_INDEX);
  if (um < si) um = si;
  return { stepIndex: si, unlockedMaxStepIndex: um };
}

/**
 * Layout persistito a 5 passi (includeva `example_phrases`) → indici di transizione a 4 passi
 * (pipeline v2..v5). Da v5 → v6 la pipeline è ulteriormente ridotta a 3 passi: dopo questo
 * step intermedio applichiamo `clampWizardIndices` che porta automaticamente al cap corrente.
 */
function migrateLegacyFiveStepIndices(
  stepIndex: number,
  unlockedMaxStepIndex: number
): { stepIndex: number; unlockedMaxStepIndex: number } {
  const map = (i: number) => (i >= 2 ? i - 1 : i);
  return clampWizardIndices(map(stepIndex), map(unlockedMaxStepIndex));
}

function parseStringRecord(v: unknown): Record<string, string> | undefined {
  if (!v || !isRecord(v)) return undefined;
  const o: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val === 'string') o[k] = val;
  }
  return Object.keys(o).length > 0 ? o : undefined;
}

function parseSuggestionStatus(v: unknown): UseCaseGeneratorWizardTurnSuggestionStatus | null {
  if (v === 'pending' || v === 'promoted' || v === 'rejected') return v;
  return null;
}

function parseSuggestion(v: unknown): UseCaseGeneratorWizardTurnSuggestion | undefined {
  if (!isRecord(v)) return undefined;
  const status = parseSuggestionStatus(v.status);
  if (!status) return undefined;
  const proposedLabel = typeof v.proposedLabel === 'string' ? v.proposedLabel : '';
  return { status, proposedLabel };
}

function parseConversationTurn(v: unknown): UseCaseGeneratorWizardTurn | null {
  if (!isRecord(v)) return null;
  const role = v.role === 'agent' ? 'agent' : v.role === 'user' ? 'user' : null;
  if (!role) return null;
  const turnId = typeof v.turnId === 'string' && v.turnId.trim() ? v.turnId.trim() : null;
  const text = typeof v.text === 'string' ? v.text : '';
  if (!turnId) return null;
  if (role === 'user') {
    const u: UseCaseGeneratorWizardTurnUser = { turnId, role: 'user', text };
    return u;
  }
  const useCaseId = typeof v.useCaseId === 'string' ? v.useCaseId : '';
  const useCaseLabel = typeof v.useCaseLabel === 'string' ? v.useCaseLabel : '';
  if (!useCaseId) return null;
  const suggestion = parseSuggestion(v.suggestion);
  const a: UseCaseGeneratorWizardTurnAgent = {
    turnId,
    role: 'agent',
    useCaseId,
    useCaseLabel,
    text,
    ...(suggestion ? { suggestion } : {}),
  };
  return a;
}

function parseOutcome(v: unknown): UseCaseGeneratorWizardConversationOutcome | null {
  if (v === 'positive' || v === 'negative') return v;
  return null;
}

function parseConversation(v: unknown): UseCaseGeneratorWizardConversation | null {
  if (!isRecord(v)) return null;
  const conversationId =
    typeof v.conversationId === 'string' && v.conversationId.trim() ? v.conversationId.trim() : null;
  if (!conversationId) return null;
  const turnsIn = Array.isArray(v.turns) ? v.turns : [];
  const turns: UseCaseGeneratorWizardTurn[] = [];
  for (const t of turnsIn) {
    const parsed = parseConversationTurn(t);
    if (parsed) turns.push(parsed);
  }
  /** Default conservativo per legacy v3: tutte le vecchie conversazioni nascono 'positive' senza suggested. */
  const outcome = parseOutcome(v.outcome) ?? 'positive';
  const allowsSuggestedUseCases = typeof v.allowsSuggestedUseCases === 'boolean' ? v.allowsSuggestedUseCases : false;
  /**
   * Descrizione sintetica dell'arco narrativo: opzionale per backward-compat (conversazioni
   * persistite prima dell'introduzione del campo restano valide, ne resta semplicemente vuoto).
   */
  const scenarioSummaryRaw = typeof v.scenarioSummary === 'string' ? v.scenarioSummary.trim() : '';
  const scenarioSummary = scenarioSummaryRaw ? scenarioSummaryRaw.slice(0, 400) : undefined;
  return {
    conversationId,
    turns,
    outcome,
    allowsSuggestedUseCases,
    ...(scenarioSummary ? { scenarioSummary } : {}),
  };
}

function parseConversationsArray(v: unknown): UseCaseGeneratorWizardConversation[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: UseCaseGeneratorWizardConversation[] = [];
  for (const item of v) {
    const c = parseConversation(item);
    if (c) out.push(c);
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Legge JSON dal Task; tollera assenza o legacy senza schemaVersion.
 * Normalizza sempre a {@link USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION} con indici validi per la pipeline attuale.
 */
export function parseUseCaseWizardPersistedState(raw: string | undefined | null): UseCaseWizardPersistedStateV1 | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!isRecord(v)) return null;

    const enabled = typeof v.enabled === 'boolean' ? v.enabled : true;
    const useCaseListBaseline =
      typeof v.useCaseListBaseline === 'string' ? v.useCaseListBaseline : undefined;
    const examplePhraseBaselineById = parseStringRecord(v.examplePhraseBaselineById);

    const rawSchema = typeof v.schemaVersion === 'number' ? v.schemaVersion : undefined;
    let stepIndex =
      typeof v.stepIndex === 'number' && v.stepIndex >= 0 && v.stepIndex <= 32 ? Math.floor(v.stepIndex) : 0;
    let unlockedMaxStepIndex =
      typeof v.unlockedMaxStepIndex === 'number' && v.unlockedMaxStepIndex >= 0 && v.unlockedMaxStepIndex <= 32
        ? Math.floor(v.unlockedMaxStepIndex)
        : stepIndex;
    if (stepIndex > unlockedMaxStepIndex) unlockedMaxStepIndex = stepIndex;

    const useLegacyMigration = rawSchema === undefined || rawSchema === 1;
    if (useLegacyMigration) {
      const m = migrateLegacyFiveStepIndices(stepIndex, unlockedMaxStepIndex);
      stepIndex = m.stepIndex;
      unlockedMaxStepIndex = m.unlockedMaxStepIndex;
    } else if (
      rawSchema === 2 ||
      rawSchema === 3 ||
      rawSchema === 4 ||
      rawSchema === 5 ||
      rawSchema === 6
    ) {
      /**
       * v2..v5: pipeline a 4 passi (l'ultimo era `json_generation`).
       * v6:     pipeline a 3 passi (rimosso `json_generation`).
       *
       * In entrambi i casi `clampWizardIndices` porta gli indici al cap corrente
       * (`WIZARD_MAX_STEP_INDEX = 2`): se un payload v5 era persistito su `stepIndex = 3`
       * (l'utente era arrivato a JSON), viene clampato a 2 (tokenization) — comportamento
       * desiderato: l'utente riapre il task e si trova all'ultimo step della nuova pipeline.
       *
       * v4 → v5 ha aggiunto `tokenizationBaselineByUseCaseId` (campo opzionale, forward-compat).
       * v5 → v6 non aggiunge campi, solo riduce la pipeline.
       */
      const c = clampWizardIndices(stepIndex, unlockedMaxStepIndex);
      stepIndex = c.stepIndex;
      unlockedMaxStepIndex = c.unlockedMaxStepIndex;
    } else {
      return null;
    }

    const conversations = parseConversationsArray(v.conversations);
    /** v3..v5 persistevano `conversationsView`: il campo viene letto e scartato silenziosamente. */
    void v.conversationsView;
    const conversationAgentBaselineByKey = parseStringRecord(v.conversationAgentBaselineByKey);
    const tokenizationBaselineByUseCaseId = parseStringRecord(
      v.tokenizationBaselineByUseCaseId
    );
    const activeConversationIdRaw =
      typeof v.activeConversationId === 'string' && v.activeConversationId.trim()
        ? v.activeConversationId.trim()
        : null;
    /** Garantisce coerenza: l'id attivo deve esistere nelle conversazioni persistite. */
    const activeConversationId = (() => {
      if (!conversations || !activeConversationIdRaw) return null;
      return conversations.some((c) => c.conversationId === activeConversationIdRaw)
        ? activeConversationIdRaw
        : null;
    })();

    return {
      schemaVersion: USE_CASE_WIZARD_PERSIST_SCHEMA_VERSION,
      enabled,
      stepIndex,
      unlockedMaxStepIndex,
      ...(useCaseListBaseline !== undefined ? { useCaseListBaseline } : {}),
      ...(examplePhraseBaselineById !== undefined ? { examplePhraseBaselineById } : {}),
      ...(conversations ? { conversations } : {}),
      ...(activeConversationId !== null ? { activeConversationId } : {}),
      ...(conversationAgentBaselineByKey
        ? { conversationAgentBaselineByKey }
        : {}),
      ...(tokenizationBaselineByUseCaseId
        ? { tokenizationBaselineByUseCaseId }
        : {}),
    };
  } catch {
    return null;
  }
}

export function serializeUseCaseWizardPersistedState(state: UseCaseWizardPersistedStateV1): string {
  return JSON.stringify(state);
}
