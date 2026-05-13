/**
 * Helper di dominio per il **gate di stile multi-pill** del passo «Conversazione» del
 * wizard use case (v2 del gate; vedi `ConversationStyleEditor`).
 *
 * Concetti:
 *  - `selections`: `Record<styleId, ConversationStyleEntry>` persistito sul Task come
 *    `agentConversationStyleSelections`. Una entry per ogni stile attivato dal designer
 *    (con eventuali override testuali — descrizione e esempio dialogo).
 *  - `auto`: checkbox **GLOBALE** «Lascia che Omnia scelga uno stile». Quando true, gli
 *    esempi di dialogo NON sono richiesti per nessuno stile checkato (l'AI inventa frasi
 *    nello stile descritto).
 *  - `checked`: flag per-entry che indica se quello stile partecipa alla generazione.
 *
 * Tutto il modulo è puro, senza dipendenze React/UI: facilmente testabile e riusabile
 * da controller, componenti, e logica di Upload.
 */

import {
  AI_AGENT_GLOBAL_USE_CASE_STYLES,
  DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID,
} from '@components/TaskEditor/EditorHost/editors/aiAgentEditor/constants';
import type { UseCaseGeneratorWizardConversation } from '@domain/useCaseGeneratorWizard/types';

export interface ConversationStyleEntry {
  /** True = la pill partecipa al batch di generazione. */
  checked: boolean;
  /** Descrizione editabile (default = `style.contract` da registry). */
  description: string;
  /** Esempi di dialogo (testo libero, multilinea). Vuoto = non fornito. */
  example: string;
}

export type ConversationStyleSelections = Record<string, ConversationStyleEntry>;

/**
 * Crea una entry di default per uno styleId dal registry. Usata quando il designer
 * clicca per la prima volta su una pill non ancora configurata.
 *
 * Fail-loud: se `styleId` non esiste nel registry, lancia (è un bug del chiamante,
 * non un caso legittimo da degradare silenziosamente).
 */
export function defaultStyleEntryForRegistryId(styleId: string): ConversationStyleEntry {
  const style = AI_AGENT_GLOBAL_USE_CASE_STYLES.find((s) => s.id === styleId);
  if (!style) {
    throw new Error(
      `[conversationStyleSelections] Unknown styleId "${styleId}". ` +
        `Expected one of: ${AI_AGENT_GLOBAL_USE_CASE_STYLES.map((s) => s.id).join(', ')}.`
    );
  }
  return {
    checked: false,
    description: style.contract,
    example: '',
  };
}

/**
 * Per backward-compat con il vecchio gate (singola textarea + checkbox auto):
 * se il task aveva `agentConversationStyleExample` non vuoto e nessuna `selections`
 * persistita, generiamo una entry seed sullo stile default (`cortese`) con
 * `checked=true` e l'esempio legacy come `example`.
 *
 * Idempotente: se `selections` già esiste/non è vuoto, ritorna `selections` invariato
 * (no overwrite dei dati v2).
 */
export function migrateLegacyStyleExample(
  selections: ConversationStyleSelections | undefined,
  legacyExample: string | undefined | null
): ConversationStyleSelections {
  if (selections && Object.keys(selections).length > 0) return selections;
  const trimmed = typeof legacyExample === 'string' ? legacyExample.trim() : '';
  if (!trimmed) return {};
  const seedId = DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID;
  const seed = defaultStyleEntryForRegistryId(seedId);
  return {
    [seedId]: {
      ...seed,
      checked: true,
      example: trimmed,
    },
  };
}

/**
 * Una entry è "valida per generazione" se:
 *  - `auto = true` → solo `description` non vuota (l'AI inventa frasi);
 *  - `auto = false` → `example` non vuoto (esempi obbligatori per gate v2).
 *
 * `description` vuota è sempre invalida: senza descrizione non sappiamo che stile chiedere.
 */
export function isStyleEntryValid(entry: ConversationStyleEntry, auto: boolean): boolean {
  if (entry.description.trim().length === 0) return false;
  if (auto) return true;
  return entry.example.trim().length > 0;
}

/**
 * Restituisce lo styleId della prima pill checkata che NON soddisfa il gate (per il
 * payoff puntuale «Devi prima scegliere uno stile / inserire un esempio»). `null` se
 * tutte le checkate sono valide o se nessuna è checkata.
 *
 * NB: l'iterazione segue l'ordine di registry (cortese → ironico → formale), così il
 * "primo problema" è deterministico anche se l'oggetto `selections` ha chiavi disordinate.
 */
export function firstInvalidCheckedStyle(
  selections: ConversationStyleSelections,
  auto: boolean
): string | null {
  for (const style of AI_AGENT_GLOBAL_USE_CASE_STYLES) {
    const entry = selections[style.id];
    if (!entry || !entry.checked) continue;
    if (!isStyleEntryValid(entry, auto)) return style.id;
  }
  return null;
}

/** Lista (ordinata da registry) degli styleId attualmente checkati. */
export function listCheckedStyleIds(selections: ConversationStyleSelections): string[] {
  return AI_AGENT_GLOBAL_USE_CASE_STYLES.filter(
    (s) => selections[s.id]?.checked === true
  ).map((s) => s.id);
}

/**
 * `true` se almeno uno stile è checkato (almeno UN candidato di generazione).
 * Indipendente dalla validità — usalo come gate primario nei wireup UI.
 */
export function hasAnyCheckedStyle(selections: ConversationStyleSelections): boolean {
  return AI_AGENT_GLOBAL_USE_CASE_STYLES.some((s) => selections[s.id]?.checked === true);
}

/**
 * Lista degli styleId che hanno **almeno una conversazione** generata. Usata da:
 *  - `ConversationStyleSelector` sopra le bubble (filtro vista),
 *  - menu Style del bottone Upload (può uplodare solo stili che hanno esempi).
 *
 * Le conversazioni legacy senza `styleId` vengono attribuite allo stile default
 * (`DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID`, oggi «Cortese»). Questo evita di
 * esporre nel menu Deploy una pill tecnica «— (n)»: per l'utente deve sempre
 * apparire uno stile reale.
 *
 * Ordine di output: come da registry; eventuali id sconosciuti vengono aggiunti
 * dopo gli stili noti per non perdere dati importati/vecchi.
 */
export function listGeneratedStyleIds(
  conversations: readonly UseCaseGeneratorWizardConversation[]
): string[] {
  const present = new Set<string>();
  for (const c of conversations) {
    if (typeof c.styleId === 'string' && c.styleId.length > 0) {
      present.add(c.styleId);
    } else {
      present.add(DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID);
    }
  }
  const ordered = AI_AGENT_GLOBAL_USE_CASE_STYLES
    .filter((s) => present.has(s.id))
    .map((s) => s.id);
  // Stili sconosciuti al registry (es. id rimosso): aggiunti dopo i conosciuti per non perderli.
  for (const id of present) {
    if (!AI_AGENT_GLOBAL_USE_CASE_STYLES.some((s) => s.id === id)) ordered.push(id);
  }
  return ordered;
}

/**
 * Predicato che dice se una conversazione "appartiene" allo stile `styleId` ai fini
 * della VISTA / FILTRO. Coerente per costruzione con {@link listGeneratedStyleIds}
 * e {@link countConversationsByStyleId}: le conversazioni legacy senza `styleId`
 * sono attribuite allo stile default. Ogni filtro UI DEVE usare questo helper,
 * altrimenti i contatori delle pill non corrispondono a ciò che viene visualizzato
 * (regressione storica: con `c.styleId === styleId` strict, le conversazioni
 * legacy contate sotto «Cortese (1)» non venivano mostrate → empty state).
 */
export function conversationMatchesStyleId(
  conversation: UseCaseGeneratorWizardConversation,
  styleId: string
): boolean {
  if (typeof conversation.styleId === 'string' && conversation.styleId.length > 0) {
    return conversation.styleId === styleId;
  }
  return styleId === DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID;
}

/**
 * Conta le conversazioni per styleId. Le conversazioni legacy senza `styleId`
 * vengono conteggiate nello stile default, per la stessa ragione di
 * {@link listGeneratedStyleIds}: il deploy e i filtri devono mostrare nomi stile reali,
 * non sentinel tecnici.
 * Utile per badge `Cortese (3)` nel selettore di filtro.
 */
export function countConversationsByStyleId(
  conversations: readonly UseCaseGeneratorWizardConversation[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of conversations) {
    const key =
      typeof c.styleId === 'string' && c.styleId.length > 0
        ? c.styleId
        : DEFAULT_AI_AGENT_GLOBAL_USE_CASE_STYLE_ID;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
