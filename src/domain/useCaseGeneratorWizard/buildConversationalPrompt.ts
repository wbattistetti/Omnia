/**
 * Costruttore del «prompt conversazionale» — il prompt unico, copiabile, che il designer passa
 * a un motore esterno (ChatGPT, ElevenLabs, …) per far comportare l'agente virtuale come
 * desiderato.
 *
 * Filosofia (decisa con il designer):
 *  - **Una sola fonte di verità per ogni use case**: la frase canonica `dialogue[0].content`,
 *    dove il designer racchiude i valori variabili tra quadre. Il JSON conversazionale è una
 *    proiezione compilata on-demand da {@link projectUseCaseToConversationalJson}; non esiste
 *    più una tokenizzazione persistita che possa divergere.
 *  - **Istruzioni IT minime e dirette**: il prompt esplicita all'inizio (1) il ruolo del
 *    motore, (2) il vincolo «usa SOLO i template forniti», (3) la semantica dei placeholder
 *    tra parentesi quadre, (4) come popolarli a runtime.
 *  - **Niente esempi compilati**: vogliamo che il motore generi, non che copi. Esempi reali
 *    causano «freezing» di varianti specifiche.
 *  - **Output stabile e deterministico**: data una stessa lista use case in input,
 *    {@link buildConversationalPrompt} produce sempre la stessa stringa. Nessun timestamp,
 *    nessun id casuale, ordering basato su `sort_order` (vedi
 *    {@link projectAllUseCasesToConversationalJson}).
 *
 * Pre-condizioni applicate dal call-site (toolbar pulsante):
 *  - Tutti gli use case del catalogo hanno una frase canonica agente compilabile
 *    ({@link areAllUseCasesProjectable}). Se il pulsante viene invocato con uno use case non
 *    proiettabile, il modulo lancia.
 */

import {
  catalogFormatCatalogHeading,
  DEFAULT_CONVERSATIONAL_CATALOG_FORMAT,
  type ConversationalCatalogFormat,
} from './catalogFormat';
import { serializeConversationalCatalog } from './serializeConversationalCatalog';
import {
  formatNonProjectableUseCasesErrorDetail,
  listNonProjectableIncludedUseCases,
  projectAllUseCasesToConversationalJson,
} from './useCaseJsonProjection';
import { buildConversationalRulesPromptSection } from '@domain/conversationalRules/buildConversationalRulesPromptSection';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  buildStartAgentPromptSection,
  type AgentStartPromptConfig,
} from './agentStartPrompt';
import {
  buildStartTurnRuleOneOverrideIt,
  buildStartUseCaseRuleSection,
  resolveStartUseCasePromptMeta,
  type StartUseCasePromptMeta,
} from './startUseCase';
import { buildBackendCallDebugPromptSection } from './backendCallDebugPrompt';
import { buildSlotLexiconGlossaryPromptSection } from '@domain/useCaseBundle/dynamicSlotRegistry';

/**
 * Opzioni di build del prompt finale. `includeLog`:
 *  - inietta nel JSON di ogni use case il campo `log: "USECASE: \"<NOME>\""` (vedi
 *    {@link projectAllUseCasesToConversationalJson});
 *  - antepone in testa al blocco "Catalogo use case" un'istruzione testuale di logging
 *    (marker `log` per UC riconosciuti; UKS se nessun template applicabile — vedi
 *    {@link PROMPT_TEMPLATE_ONLY_UKS_IT}).
 *
 * Default `false` (back-compat): i task gi\u00e0 pubblicati continuano a generare lo stesso
 * prompt di prima finch\u00e9 il designer non attiva il toggle "Logga Use Case" dal menu Upload.
 */
/** Comportamento runtime quando l'input non mappa su nessun use case (UKS). */
export type AgentBehaviorMode = 'A' | 'B' | 'C';

export interface BuildConversationalPromptOptions {
  readonly includeLog?: boolean;
  readonly agentBehavior?: AgentBehaviorMode;
  /** Optional cross-cutting rules (separate from business use-case catalog). */
  readonly conversationalRules?: readonly ConversationalRule[];
  /** Formato serializzazione catalogo use case. Default {@link DEFAULT_CONVERSATIONAL_CATALOG_FORMAT}. */
  readonly catalogFormat?: ConversationalCatalogFormat;
  /** Frase di apertura sessione (scenario startAgent), separata dal catalogo. */
  readonly startPrompt?: AgentStartPromptConfig;
  /** Id use case marcato Start (regola di apertura sessione). */
  readonly startUseCaseId?: string;
  /** Debug chiamate backend nel prompt (indipendente da includeLog). */
  readonly includeBackendLog?: boolean;
  /** Lessico per `tokenBindings` nel catalogo JSON. */
  readonly lexicon?: import('@domain/useCaseBundle/projectSlotLexicon').ProjectSlotLexicon;
  /** Binding RECEIVE → slot per `fillFrom` nel catalogo JSON. */
  readonly backendOutputSlotBindings?: import('@domain/backendOutputSlotBinding/types').AgentBackendOutputSlotBindings;
}

/**
 * Regola vincolante Template-Only + UKS: ogni turno deve usare un solo template del
 * catalogo oppure dichiarare UKS senza testo libero.
 */
const PROMPT_TEMPLATE_ONLY_UKS_IT = `Regola vincolante: Template-Only + UKS
Obbligatoria per ogni turno

Output vincolato
Ogni turno deve essere esattamente una frase del catalogo (\`tokenizedExample\` o equivalente DSL), con sostituzione dei soli token \`[ … ]\`.

Vietato testo libero.

Vietato modificare o aggiungere parole fuori dal template.

Fallback UKS
Se non esiste alcun template applicabile:

Non inventare frasi.

Rispondere solo con \`USECASE: "UKS"\`.

Marker USECASE

Deve apparire solo in fondo alla frase (o da solo nel caso UKS).

Mai dentro il corpo del testo.

Esempi negativi (da non produrre)

❌ «Grazie per la conferma. Procedo a cercare la disponibilità… USECASE:6»

❌ «Ho controllato, il dottor Lorenzi è disponibile… USECASE:17» (non da template).

Esempi positivi (corretti)

✅ «Per [prestazione], preferisce prima visita o visita di controllo?» seguito dal campo \`log\` dell'use case (es. \`USECASE: "6 — TIPOLOGIA VISITA"\`).

✅ \`USECASE: "UKS"\` (quando non c'è template applicabile).`;

/**
 * Istruzione testuale di logging iniettata in testa al blocco catalogo quando
 * `includeLog` è `true`. Coerente con {@link PROMPT_TEMPLATE_ONLY_UKS_IT}.
 */
const PROMPT_LOG_INSTRUCTION_IT = `Logging use case
Per ogni risposta restituisci il marker dello use case applicato, rispettando la Regola Template-Only + UKS:
- Se hai riconosciuto uno dei casi del catalogo qui sotto: una sola frase dal template compilato, poi copia letteralmente il valore del campo \`log\` di quello use case (formato: \`USECASE: "<NUMERO> — <NOME>"\`, es. \`USECASE: "3 — SALUTO CLIENTE"\`; numero e nome in MAIUSCOLO).
- Se NESSUN template del catalogo è applicabile: non inventare frasi né trace \`NUOVO_*\`; rispondi solo con \`USECASE: "UKS"\`.
- Il marker va sempre in fondo (preferibilmente su nuova riga). Mai nel corpo del testo.`;

/**
 * Sezione testuale iniziale del prompt: istruzioni operative per il motore esterno.
 *
 * Mantenuta come template costante (non parametrizzata) per garantire identicità della
 * formulazione tra invocazioni e tra istanze: il designer e il motore esterno costruiscono
 * familiarità su una guida fissa. Variazioni intenzionali vanno fatte qui, non al call-site.
 */
function buildUksInstruction(agentBehavior: AgentBehaviorMode): string {
  const base = `Use Case non riconosciuto (UKS)
Se NESSUN template del catalogo è applicabile al turno, NON forzare un mapping su un use case numerato.
Rispetta la Regola Template-Only + UKS: rispondi esclusivamente con \`USECASE: "UKS"\` (nessun altro testo).`;
  switch (agentBehavior) {
    case 'A':
    case 'B':
      return base;
    case 'C':
      return `${base}
Comportamento C: tieni traccia internamente dei turni UKS consecutivi; dopo due UKS di seguito segnala in design-time che serve un nuovo use case o passaggio operatore — senza aggiungere testo libero in risposta.`;
    default:
      return base;
  }
}

function buildPromptHeaderIt(
  catalogFormat: ConversationalCatalogFormat,
  startMeta?: StartUseCasePromptMeta | null
): string {
  const catalogHeading = catalogFormatCatalogHeading(catalogFormat);
  const isDsl = catalogFormat === 'dsl-standard' || catalogFormat === 'dsl-ultra';
  const templateHint = isDsl
    ? 'il testo dopo \`SAY:\` (o il campo \`t\` nel JSON minimo) è il template'
    : 'il campo \`tokenizedExample\` (o \`t\` nel JSON minimo) è il template';
  const variantHint = isDsl
    ? 'rispetta \`WHEN:\` per scegliere la variante corretta'
    : 'rispetta \`when\` per scegliere la variante corretta';

  const rule1 = startMeta
    ? buildStartTurnRuleOneOverrideIt(startMeta)
    : `1. Per ogni interazione, scegli un solo use case tra quelli applicabili (il più adatto al turno); usa una sola variante — ${templateHint}; ${variantHint}.`;

  const rulesTail = startMeta
    ? `2. Nel catalogo NON inventare frasi: sostituisci SOLO i token tra \`[…]\`. Fuori catalogo: solo UKS come in «Template-Only + UKS» sopra.
3. I token tra parentesi quadre vanno sostituiti con valori coerenti col contesto; per token di stile \`«…»\` usa \`tokens_stile\` / blocco STYLE se presente.
4. NON lasciare parentesi quadre visibili nella risposta finale.
5. Non cambiare le stringhe fuori dai token: copia letterale il testo fisso del template.
6. Usa lo \`scenario\` LLM (intestazione UC o campo \`s\` / \`scenario\`) per decidere QUANDO applicare l'use case.
7. Il \`label\` interno e gli id tecnici non vanno citati all'utente.
8. Se la variante ha \`tokenBindings\`: per ogni token usa \`fillFrom\` (campo RECEIVE) per popolare il valore; \`toolName\` e \`sendParams\` indicano quale tool backend invocare e con quali parametri SEND.
9. Se l'use case ha \`slotBackendContract\`: è la mappa canonica slot_id → { tool, receive, send? }; allinea \`tokenBindings\` a questa mappa. I campi RECEIVE per \`fillFrom\` sono nel blocco BACKEND RECEIVE; non duplicare per UC.
10. Se \`tokenBindings\` include \`sendPath\`, \`valueKind\` e \`role\`: usa lo schema del tool webhook indicato da \`toolName\`; non inventare path. Per date relative usa \`valueKind\` (es. end_of_month, tomorrow, specific_date) quando presente.`
    : `2. Nel catalogo NON inventare frasi: sostituisci SOLO i token tra \`[…]\`. Fuori catalogo: solo UKS come in «Template-Only + UKS» sopra.
3. I token tra parentesi quadre vanno sostituiti con valori coerenti col contesto; per token di stile \`«…»\` usa \`tokens_stile\` / blocco STYLE se presente.
4. NON lasciare parentesi quadre visibili nella risposta finale.
5. Non cambiare le stringhe fuori dai token: copia letterale il testo fisso del template.
6. Usa lo \`scenario\` LLM (intestazione UC o campo \`s\` / \`scenario\`) per decidere QUANDO applicare l'use case.
7. Il \`label\` interno e gli id tecnici non vanno citati all'utente.
8. Se la variante ha \`tokenBindings\`: per ogni token usa \`fillFrom\` (campo RECEIVE) per popolare il valore; \`toolName\` e \`sendParams\` indicano quale tool backend invocare e con quali parametri SEND.
9. Se l'use case ha \`slotBackendContract\`: è la mappa canonica slot_id → { tool, receive, send? }; allinea \`tokenBindings\` a questa mappa. I campi RECEIVE per \`fillFrom\` sono nel blocco BACKEND RECEIVE; non duplicare per UC.
10. Se \`tokenBindings\` include \`sendPath\`, \`valueKind\` e \`role\`: usa lo schema del tool webhook indicato da \`toolName\`; non inventare path. Per date relative usa \`valueKind\` (es. end_of_month, tomorrow, specific_date) quando presente.`;

  return `Ruolo
Sei l'agente virtuale di un servizio fissato dal progettista. Devi parlare e rispondere ESCLUSIVAMENTE come definito dal catalogo use case più sotto.

${PROMPT_TEMPLATE_ONLY_UKS_IT}

Regole obbligatorie
${rule1}
${rulesTail}

${catalogHeading}
Ogni voce elenca lo scenario LLM e il template da compilare (almeno una variante per UC).`;
}

/**
 * Costruisce il prompt conversazionale combinando istruzioni IT + catalogo JSON degli use
 * case. Pre-condizione: tutti gli use case devono avere una frase canonica compilabile.
 *
 * @throws Error se la lista è vuota o se uno use case non è proiettabile. È un errore di
 * programmazione: il caller deve filtrare via UI (pulsante «Crea prompt conversazionale»
 * visibile solo se tutti hanno un messaggio canonico compilabile).
 */
export function buildConversationalPrompt(
  useCases: readonly AIAgentUseCase[],
  options: BuildConversationalPromptOptions = {}
): string {
  if (useCases.length === 0) {
    throw new Error(
      'buildConversationalPrompt: il catalogo use case è vuoto. ' +
        'Il pulsante «Crea prompt conversazionale» non dovrebbe essere visibile in questo stato.'
    );
  }
  const lexicon = options.lexicon;
  const bindings = options.backendOutputSlotBindings;
  const nonProjectable = listNonProjectableIncludedUseCases(useCases, lexicon, bindings);
  if (nonProjectable.length > 0) {
    throw new Error(
      `buildConversationalPrompt: ${formatNonProjectableUseCasesErrorDetail(nonProjectable)}`
    );
  }

  const startMeta = resolveStartUseCasePromptMeta(useCases, options.startUseCaseId);

  const includeLog = options.includeLog === true;
  const agentBehavior = options.agentBehavior ?? 'B';
  const catalogFormat = options.catalogFormat ?? DEFAULT_CONVERSATIONAL_CATALOG_FORMAT;
  const projected = projectAllUseCasesToConversationalJson(useCases, {
    includeLog,
    lexicon: options?.lexicon,
    backendOutputSlotBindings: options?.backendOutputSlotBindings,
  });
  const catalogBody = serializeConversationalCatalog(projected, catalogFormat);

  /**
   * Quando `includeLog` è attivo, l'istruzione testuale di logging va **in testa al blocco
   * catalogo** (non nello header generale): è semanticamente legata al catalogo
   * — descrive cosa fare con i campi `log` che il motore vede subito dopo.
   */
  const uksBlock = buildUksInstruction(agentBehavior);
  const catalogSection = includeLog
    ? `${PROMPT_LOG_INSTRUCTION_IT}\n\n${uksBlock}\n\n${catalogBody}`
    : `${uksBlock}\n\n${catalogBody}`;

  const startUseCaseSection = buildStartUseCaseRuleSection(
    useCases,
    options.startUseCaseId
  );
  const startAgentSection =
    startUseCaseSection.trim().length > 0
      ? ''
      : buildStartAgentPromptSection(
          options.startPrompt ?? { schemaVersion: 1, text: '', variants: [] }
        );
  const rulesSection = buildConversationalRulesPromptSection(
    options.conversationalRules ?? []
  );
  const backendDebugSection = buildBackendCallDebugPromptSection(
    options.includeBackendLog === true
  );
  const slotGlossarySection =
    lexicon != null ? buildSlotLexiconGlossaryPromptSection(lexicon) : '';
  const bodyParts = [
    startUseCaseSection.trim(),
    startAgentSection.trim(),
    backendDebugSection.trim(),
    slotGlossarySection.trim(),
    catalogSection.trim(),
    rulesSection.trim(),
  ].filter(Boolean);
  const body = bodyParts.join('\n\n');
  return `${buildPromptHeaderIt(catalogFormat, startMeta)}\n\n${body}\n`;
}
