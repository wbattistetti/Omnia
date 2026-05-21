/**
 * Design-time use case composer: logical steps + hierarchical scenarios with payoff and agent output.
 */

import type {
  AIAgentCanonicalPhrase,
} from '../domain/useCaseBundle/schema';
import type { AgentMessageMotorPayload } from '../domain/aiAgentUseCase/splitAgentMessageTemplate';
import { ensureUseCasePhrases } from '../domain/useCaseBundle/migrateUseCase';
import {
  parseAgentUseCaseBundleDocument,
  parseAgentUseCaseBundleJson,
  serializeAgentUseCaseBundle,
} from '../domain/useCaseBundle/parseSerializeBundle';
import type { AIAgentUseCaseResponse } from '../domain/aiAgentUseCase/useCaseResponseTasks';
import {
  ensureUseCaseResponse,
  parseUseCaseResponseField,
} from '../domain/aiAgentUseCase/useCaseResponseTasks';
export type { AIAgentUseCaseResponse } from '../domain/aiAgentUseCase/useCaseResponseTasks';

export type { AIAgentCanonicalPhrase, AIAgentPhraseParametricDimension, AIAgentPhraseParametricRow, AIAgentPhraseParametricConfig, AIAgentPhraseVariant, PhraseCompiledSnapshot, SlotSurfaceMapping } from '../domain/useCaseBundle/schema';

/** Last IA-synced motor JSON for an assistant turn; compare source_content to detect stale edits. */
export interface AIAgentAssistantMotorSnapshot {
  source_content: string;
  payload: AgentMessageMotorPayload;
}

export interface AIAgentLogicalStep {
  id: string;
  description: string;
}

/** Raggruppamento UI / lettura designer (ortogonale a parent_id). */
export interface AIAgentUseCaseCategory {
  id: string;
  label: string;
  sort_order: number;
  /** Breve guida designer (1–2 frasi), opzionale — da IA o edit manuale. */
  description?: string;
}

/** Categoria di fallback quando il bundle non ne definisce. */
export const DEFAULT_USE_CASE_CATEGORY_ID = 'cat_generale';

/** Scenario: testo canonico sintetico (`llm`); `descrittivo` e `payoff` sono mirror per compatibilità. */
export interface AIAgentUseCaseScenario {
  descrittivo: string;
  llm: string;
}

export interface AIAgentUseCaseTurn {
  turn_id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Product rule: assistant true, user false; set by system, not the LLM. */
  editable?: boolean;
  userEdited?: boolean;
  locked?: boolean;
  /** Populated when designer runs Crea/Aggiorna JSON; invalidated when IA replaces message without re-annotate. */
  motor_snapshot?: AIAgentAssistantMotorSnapshot;
}

export interface AIAgentUseCase {
  id: string;
  label: string;
  parent_id: string | null;
  sort_order: number;
  /** Id in {@link AIAgentUseCaseCategory}; assente o non valido = use case in lista piatta (radice). */
  category_id?: string | null;
  refinement_prompt: string;
  /** Global style id (cortese / ironico / formale) for this use case contract. */
  style_id?: string;
  /**
   * Scenario strutturato: `llm` è il testo canonico; `descrittivo` è mirror (stesso valore).
   */
  scenario?: AIAgentUseCaseScenario;
  /** Alias persistito di `scenario.llm` (backward compat e edit UI). */
  payoff?: string;
  dialogue: AIAgentUseCaseTurn[];
  notes: {
    behavior: string;
    tone: string;
  };
  bubble_notes: Record<string, string>;
  /** Design-time wizard: conferma dopo modifica manuale (spunta). */
  designer_edit_confirmed?: boolean;
  /** Design-time wizard: visto/ok con cerchio anche senza modifica. */
  designer_acknowledged?: boolean;
  /** Validazione manuale: su / giù / da approfondire (`review`). */
  designer_label_vote?: 'up' | 'down' | 'review';
  designer_payoff_vote?: 'up' | 'down' | 'review';
  designer_agent_message_vote?: 'up' | 'down' | 'review';
  /**
   * Wizard passo 3 «Tokenizzazione»: versione della frase canonica assistente con le parti
   * variabili sostituite da placeholder tra parentesi quadre (es. `[data]`, `[ora1]`, `[nome]`).
   * Vive QUI come campo top-level dello use case (non dentro il `dialogue` turn) perché
   * concettualmente è una proprietà della frase canonica del caso d'uso, non di un singolo turno
   * del dialogo di esempio.
   *
   * Token semantica:
   * - i token sono interni alla gente virtuale (es. ElevenLabs); NON mappano a variabili Omnia,
   *   non hanno GUID e non influenzano il flow;
   * - una frase senza parti variabili resta IDENTICA all'originale (non si tokenizza forzatamente);
   * - gli indici numerici (`[data1]`, `[ora2]`) sono usati SOLO quando lo stesso tipo compare più
   *   volte nella stessa frase per disambiguare.
   *
   * Vita del campo:
   * - assente / stringa vuota = frase non ancora tokenizzata;
   * - presente = ultima tokenizzazione (AI o manuale).
   *
   * Staleness (vedi {@link assistant_example_tokenized_source}): se il canonico viene modificato
   * dopo la tokenizzazione, il valore resta ma è considerato «da ritokenizzare» finché il
   * designer non lo aggiorna a mano o non ri-genera con l'AI.
   */
  assistant_example_tokenized?: string;
  /**
   * Snapshot del canonico assistente (`dialogue` assistant turn `content`) al momento in cui
   * `assistant_example_tokenized` è stato prodotto. Confrontato col canonico corrente per
   * derivare lo stato «stale» senza dover invalidare attivamente in ogni punto di edit.
   *
   * Convenzione: se `assistant_example_tokenized` è valorizzato e questo source è diverso dal
   * `content` corrente dell'assistente, la UI mostra l'avviso «da ritokenizzare».
   */
  assistant_example_tokenized_source?: string;

  /**
   * Flag di **inclusione nelle conversazioni**. Quando `false` (l'utente ha tolto la spunta
   * dall'header del use case), il use case:
   *   - NON viene mandato al modello quando si genera/proofread le conversazioni di esempio;
   *   - NON finisce nel JSON proiettato per il system prompt (`projectAllUseCasesToConversationalJson`);
   *   - NON viene visualizzato come bubble nella conversation view (le bubble eventualmente gi\u00e0
   *     generate restano in storage e tornano visibili se il use case viene re-incluso).
   *
   * Resta invece sempre presente in TUTTI i contesti di "lista esistente" passati all'IA per
   * proporre nuovi use case (`generateUseCaseBundleExtend.existingUseCases`,
   * `regenerateUseCase.allCases`, ecc.) — \u00e8 noto al sistema, non va ricreato come duplicato.
   *
   * Backward-compat: campo opzionale, default `true` (use case storici senza il campo sono
   * considerati inclusi). Vedi {@link isUseCaseIncludedInConversations}.
   */
  included_in_conversations?: boolean;

  /**
   * Schema v2: una o più frasi canoniche con varianti strutturali e compile snapshot.
   * Assente su record legacy → {@link ensureUseCasePhrases} alla lettura.
   */
  phrases?: AIAgentCanonicalPhrase[];

  /**
   * Operational response: ordered tasks (sayMessage + actions). Same shape as escalation.tasks.
   * Absent on legacy rows → {@link ensureUseCaseResponse} at read time.
   */
  response?: AIAgentUseCaseResponse;
}

/** Stable id for a dialogue turn (exported for UI bridge). */
export function newAgentUseCaseTurnId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Restituisce il `content` del primo turno assistant del `dialogue` (frase canonica del use case),
 * oppure stringa vuota se assente. Utility centralizzata per evitare scan ripetuti dello stesso
 * pattern in più punti (wizard tokenizzazione, bubble Passo 2, baseline diff, ecc.).
 */
export function getAssistantExample(useCase: AIAgentUseCase): string {
  const phrases = useCase?.phrases;
  if (Array.isArray(phrases) && phrases.length > 0) {
    const t = phrases[0].naturalText;
    if (typeof t === 'string') return t;
  }
  const dialogue = Array.isArray(useCase?.dialogue) ? useCase.dialogue : [];
  const assistant = dialogue.find((t) => t && t.role === 'assistant');
  return assistant && typeof assistant.content === 'string' ? assistant.content : '';
}

/**
 * True se lo use case partecipa alla generazione/visualizzazione delle conversazioni e al JSON
 * del system prompt finale.
 *
 * Regola di default: assenza del campo == `true` (inclusion is the default). Solo `false`
 * esplicito esclude — coerente col fatto che storicamente tutti i use case erano usati e non
 * vogliamo cambiare il comportamento dei task pre-feature.
 */
export function isUseCaseIncludedInConversations(useCase: AIAgentUseCase): boolean {
  return useCase?.included_in_conversations !== false;
}

/**
 * True quando lo use case ha già una tokenizzazione registrata MA il canonico corrente è cambiato
 * rispetto allo snapshot al momento della tokenizzazione (`assistant_example_tokenized_source`).
 * Pattern alternativo al «clear-on-edit»: non serve invalidare attivamente in ogni call site di
 * modifica del canonico, perché la staleness è derivata dal confronto strutturale.
 *
 * Casi:
 * - nessuna tokenizzazione presente → false (non c'è nulla di stale, è semplicemente «vuoto»);
 * - tokenizzazione presente senza source registrato (legacy) → considerata stale, così la UI
 *   invita a rigenerare/aggiornare;
 * - tokenizzazione presente, source = canonico corrente → fresh;
 * - tokenizzazione presente, source ≠ canonico corrente → stale.
 */
export function isAssistantExampleTokenizationStale(useCase: AIAgentUseCase): boolean {
  const tokenized = useCase?.assistant_example_tokenized;
  if (typeof tokenized !== 'string' || !tokenized) return false;
  const currentCanonical = getAssistantExample(useCase);
  const source = useCase?.assistant_example_tokenized_source;
  if (typeof source !== 'string') return true;
  return source !== currentCanonical;
}

function newTurnId(): string {
  return newAgentUseCaseTurnId();
}

function newUseCaseId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `uc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Empty bundle for new tasks. */
export function emptyUseCaseBundle(): {
  logical_steps: AIAgentLogicalStep[];
  use_cases: AIAgentUseCase[];
} {
  return { logical_steps: [], use_cases: [] };
}

/** One root use case with minimal dialogue for manual start. */
export function createDefaultRootUseCase(): AIAgentUseCase {
  const id = newUseCaseId();
  const t1 = newTurnId();
  return {
    id,
    label: 'Scenario principale',
    parent_id: null,
    sort_order: 0,
    refinement_prompt: '',
    payoff: '',
    dialogue: [{ turn_id: t1, role: 'assistant', content: '', editable: true }],
    notes: { behavior: '', tone: '' },
    bubble_notes: {},
  };
}

/**
 * Parse persisted JSON strings from Task; fails closed to empty on invalid input.
 */
export function parseAgentLogicalStepsJson(raw: string | undefined): AIAgentLogicalStep[] {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    const out: AIAgentLogicalStep[] = [];
    for (const e of v) {
      if (!e || typeof e !== 'object') continue;
      const o = e as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id.trim() : '';
      const description = typeof o.description === 'string' ? o.description : '';
      if (id) out.push({ id, description });
    }
    return out;
  } catch {
    return [];
  }
}

export function parseAgentUseCasesJson(raw: string | undefined): AIAgentUseCase[] {
  return parseAgentUseCaseBundleJson(raw);
}

export function parseAgentUseCaseBundleWithCategories(raw: string | undefined): {
  useCases: AIAgentUseCase[];
  categories: AIAgentUseCaseCategory[];
} {
  return parseAgentUseCaseBundleDocument(raw);
}

/** Parse array grezzo use case (v1 o elemento di `use_cases` v2). */
export function parseAgentUseCasesJsonLegacyArray(v: unknown): AIAgentUseCase[] {
  if (!Array.isArray(v)) return [];
  const out: AIAgentUseCase[] = [];
  for (const e of v) {
      if (!e || typeof e !== 'object') continue;
      const o = e as Record<string, unknown>;
      const id = typeof o.id === 'string' ? o.id.trim() : '';
      if (!id) continue;
      const label = typeof o.label === 'string' ? o.label : 'Use case';
      const rawParent = o.parent_id;
      const parent_id =
        rawParent === null || rawParent === undefined
          ? null
          : typeof rawParent === 'string' && rawParent.trim()
            ? rawParent.trim()
            : null;
      const sort_order = typeof o.sort_order === 'number' && Number.isFinite(o.sort_order) ? o.sort_order : 0;
      const rawCategoryId = o.category_id;
      const category_id =
        rawCategoryId === null || rawCategoryId === undefined
          ? null
          : typeof rawCategoryId === 'string' && rawCategoryId.trim()
            ? rawCategoryId.trim()
            : null;
      const refinement_prompt =
        typeof o.refinement_prompt === 'string' ? o.refinement_prompt : '';
      const style_id =
        typeof o.style_id === 'string' && o.style_id.trim()
          ? o.style_id.trim()
          : typeof (o as Record<string, unknown>).style === 'string' &&
              String((o as Record<string, unknown>).style).trim()
            ? String((o as Record<string, unknown>).style).trim()
            : undefined;
      let descrittivo = '';
      let llm = '';
      const rawScenario = o.scenario;
      if (rawScenario && typeof rawScenario === 'object' && !Array.isArray(rawScenario)) {
        const so = rawScenario as Record<string, unknown>;
        if (typeof so.descrittivo === 'string' && so.descrittivo.trim()) {
          descrittivo = so.descrittivo.trim();
        }
        if (typeof so.llm === 'string' && so.llm.trim()) {
          llm = so.llm.trim();
        }
      }
      if (!llm && descrittivo) llm = descrittivo.slice(0, Math.min(2000, descrittivo.length));
      if (!llm && typeof o.payoff === 'string' && o.payoff.trim()) llm = o.payoff.trim();
      else if (!llm && typeof o.description === 'string' && o.description.trim()) {
        llm = o.description.trim();
      }
      const text = llm || descrittivo;
      const payoff = text;
      const scenario = text ? { descrittivo: text, llm: text } : undefined;
      const notesRaw = o.notes && typeof o.notes === 'object' ? (o.notes as Record<string, unknown>) : {};
      const behavior = typeof notesRaw.behavior === 'string' ? notesRaw.behavior : '';
      const tone = typeof notesRaw.tone === 'string' ? notesRaw.tone : '';
      const bubble_notes: Record<string, string> = {};
      if (o.bubble_notes && typeof o.bubble_notes === 'object' && !Array.isArray(o.bubble_notes)) {
        for (const [k, val] of Object.entries(o.bubble_notes as Record<string, unknown>)) {
          if (typeof val === 'string') bubble_notes[k] = val;
        }
      }
      const dialogue: AIAgentUseCaseTurn[] = [];
      if (Array.isArray(o.dialogue)) {
        for (const t of o.dialogue) {
          if (!t || typeof t !== 'object') continue;
          const tr = t as Record<string, unknown>;
          const turn_id =
            typeof tr.turn_id === 'string' && tr.turn_id.trim()
              ? tr.turn_id.trim()
              : newTurnId();
          const role = tr.role === 'user' ? 'user' : 'assistant';
          const content = typeof tr.content === 'string' ? tr.content : '';
          const editable =
            typeof tr.editable === 'boolean'
              ? tr.editable
              : role === 'assistant'
                ? true
                : false;
          const turnBase = {
            turn_id,
            role,
            content,
            ...(role === 'assistant' ? { editable } : { editable: false }),
            userEdited: tr.userEdited === true,
            locked: tr.locked === true,
          };
          const ms = tr.motor_snapshot;
          if (
            role === 'assistant' &&
            ms &&
            typeof ms === 'object' &&
            typeof (ms as Record<string, unknown>).source_content === 'string' &&
            (ms as Record<string, unknown>).payload &&
            typeof (ms as Record<string, unknown>).payload === 'object'
          ) {
            dialogue.push({
              ...turnBase,
              motor_snapshot: ms as AIAgentAssistantMotorSnapshot,
            });
          } else {
            dialogue.push(turnBase);
          }
        }
      }
      const designer_edit_confirmed = o.designer_edit_confirmed === true;
      const designer_acknowledged = o.designer_acknowledged === true;
      const designer_label_vote =
        o.designer_label_vote === 'up' ||
        o.designer_label_vote === 'down' ||
        o.designer_label_vote === 'review'
          ? o.designer_label_vote
          : undefined;
      const designer_payoff_vote =
        o.designer_payoff_vote === 'up' ||
        o.designer_payoff_vote === 'down' ||
        o.designer_payoff_vote === 'review'
          ? o.designer_payoff_vote
          : undefined;
      const designer_agent_message_vote =
        o.designer_agent_message_vote === 'up' ||
        o.designer_agent_message_vote === 'down' ||
        o.designer_agent_message_vote === 'review'
          ? o.designer_agent_message_vote
          : undefined;
      const assistant_example_tokenized =
        typeof o.assistant_example_tokenized === 'string'
          ? o.assistant_example_tokenized
          : undefined;
      const assistant_example_tokenized_source =
        typeof o.assistant_example_tokenized_source === 'string'
          ? o.assistant_example_tokenized_source
          : undefined;
      const phrases = parsePhrasesField(o.phrases);
      const response = parseUseCaseResponseField(o.response);
      out.push({
        id,
        label,
        parent_id,
        sort_order,
        ...(category_id ? { category_id } : {}),
        refinement_prompt,
        ...(style_id ? { style_id } : {}),
        ...(scenario ? { scenario } : {}),
        ...(payoff ? { payoff } : {}),
        dialogue,
        notes: { behavior, tone },
        bubble_notes,
        ...(designer_edit_confirmed ? { designer_edit_confirmed: true } : {}),
        ...(designer_acknowledged ? { designer_acknowledged: true } : {}),
        ...(designer_label_vote ? { designer_label_vote } : {}),
        ...(designer_payoff_vote ? { designer_payoff_vote } : {}),
        ...(designer_agent_message_vote ? { designer_agent_message_vote } : {}),
        ...(assistant_example_tokenized !== undefined
          ? { assistant_example_tokenized }
          : {}),
        ...(assistant_example_tokenized_source !== undefined
          ? { assistant_example_tokenized_source }
          : {}),
        ...(phrases.length > 0 ? { phrases } : {}),
        ...(response ? { response } : {}),
      });
    }
  return out.map((uc) => ensureUseCaseResponse(ensureUseCasePhrases(uc)));
}

function parsePhrasesField(raw: unknown): AIAgentCanonicalPhrase[] {
  if (!Array.isArray(raw)) return [];
  const out: AIAgentCanonicalPhrase[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const po = p as Record<string, unknown>;
    const phraseId = typeof po.phraseId === 'string' && po.phraseId.trim() ? po.phraseId.trim() : '';
    const naturalText = typeof po.naturalText === 'string' ? po.naturalText : '';
    if (!phraseId) continue;
    const variantsRaw = Array.isArray(po.variants) ? po.variants : [];
    let variants = variantsRaw
      .map((vr) => {
        if (!vr || typeof vr !== 'object') return null;
        const vo = vr as Record<string, unknown>;
        const variantId =
          typeof vo.variantId === 'string' && vo.variantId.trim() ? vo.variantId.trim() : '';
        if (!variantId) return null;
        return {
          variantId,
          ...(typeof vo.naturalText === 'string' ? { naturalText: vo.naturalText } : {}),
          ...(typeof vo.when === 'string' && vo.when.trim() ? { when: vo.when.trim() } : {}),
          ...(vo.compiled && typeof vo.compiled === 'object'
            ? { compiled: parseCompiledField(vo.compiled as Record<string, unknown>) }
            : {}),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (variants.length === 0) {
      variants = [{ variantId: 'default' }];
    }
    out.push({
      phraseId,
      naturalText,
      variants,
      ...(Array.isArray(po.localMappings) ? { localMappings: parseMappings(po.localMappings) } : {}),
    });
  }
  return out;
}

function parseMappings(raw: unknown): import('../domain/useCaseBundle/schema').SlotSurfaceMapping[] {
  if (!Array.isArray(raw)) return [];
  const out: import('../domain/useCaseBundle/schema').SlotSurfaceMapping[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const mo = m as Record<string, unknown>;
    const surface = typeof mo.surface === 'string' ? mo.surface.trim() : '';
    const slot_id = typeof mo.slot_id === 'string' ? mo.slot_id.trim() : '';
    if (surface && slot_id) {
      out.push({
        surface,
        slot_id,
        ...(mo.localOnly === true ? { localOnly: true } : {}),
      });
    }
  }
  return out;
}

function parseCompiledField(
  o: Record<string, unknown>
): import('../domain/useCaseBundle/schema').PhraseCompiledSnapshot | undefined {
  const tokenizedText = typeof o.tokenizedText === 'string' ? o.tokenizedText : '';
  if (!tokenizedText.trim()) return undefined;
  const tokens = Array.isArray(o.tokens)
    ? o.tokens.filter((t): t is string => typeof t === 'string')
    : [];
  const mappings = parseMappings(o.mappings);
  const status = o.status === 'stale' ? 'stale' : 'fresh';
  const compiledAt = typeof o.compiledAt === 'string' ? o.compiledAt : '';
  return {
    tokenizedText,
    tokens,
    mappings,
    status,
    compiledAt: compiledAt || new Date(0).toISOString(),
  };
}

export function serializeLogicalSteps(steps: readonly AIAgentLogicalStep[]): string {
  return JSON.stringify([...steps]);
}

export function serializeUseCases(
  cases: readonly AIAgentUseCase[],
  categories: readonly AIAgentUseCaseCategory[] = []
): string {
  return serializeAgentUseCaseBundle(cases, categories);
}

/** Normalize LLM/API arrays into typed logical steps. */
export function parseAgentLogicalStepsFromApi(value: unknown): AIAgentLogicalStep[] {
  if (!Array.isArray(value)) return [];
  return parseAgentLogicalStepsJson(JSON.stringify(value));
}

/** Normalize LLM/API arrays into typed use cases. */
export function parseAgentUseCasesFromApi(value: unknown): AIAgentUseCase[] {
  if (!Array.isArray(value)) return [];
  return parseAgentUseCasesJson(JSON.stringify(value));
}

/**
 * Single use_case object from regenerate endpoint.
 * @returns null if payload cannot be normalized.
 */
export function parseOneUseCaseFromApi(value: unknown): AIAgentUseCase | null {
  if (!value || typeof value !== 'object') return null;
  const list = parseAgentUseCasesFromApi([value]);
  return list[0] ?? null;
}

/**
 * Single dialogue turn from regenerate_turn endpoint.
 * @returns null if payload cannot be normalized.
 */
export function parseAgentUseCaseTurnFromApi(value: unknown): AIAgentUseCaseTurn | null {
  if (!value || typeof value !== 'object') return null;
  const tr = value as Record<string, unknown>;
  const turn_id =
    typeof tr.turn_id === 'string' && tr.turn_id.trim() ? tr.turn_id.trim() : newTurnId();
  const role = tr.role === 'user' ? 'user' : 'assistant';
  const content = typeof tr.content === 'string' ? tr.content : '';
  const editable =
    typeof tr.editable === 'boolean' ? tr.editable : role === 'assistant' ? true : false;
  const base = {
    turn_id,
    role,
    content,
    ...(role === 'assistant' ? { editable } : { editable: false }),
    userEdited: tr.userEdited === true,
    locked: tr.locked === true,
  };
  const ms = tr.motor_snapshot;
  if (
    role === 'assistant' &&
    ms &&
    typeof ms === 'object' &&
    typeof (ms as Record<string, unknown>).source_content === 'string' &&
    (ms as Record<string, unknown>).payload &&
    typeof (ms as Record<string, unknown>).payload === 'object'
  ) {
    return { ...base, motor_snapshot: ms as AIAgentAssistantMotorSnapshot };
  }
  return base;
}
