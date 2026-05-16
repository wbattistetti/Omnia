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
  areAllUseCasesProjectable,
  projectAllUseCasesToConversationalJson,
} from './useCaseJsonProjection';
import { buildConversationalRulesPromptSection } from '@domain/conversationalRules/buildConversationalRulesPromptSection';
import type { ConversationalRule } from '@domain/conversationalRules/types';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

/**
 * Opzioni di build del prompt finale. `includeLog`:
 *  - inietta nel JSON di ogni use case il campo `log: "USECASE: \"<NOME>\""` (vedi
 *    {@link projectAllUseCasesToConversationalJson});
 *  - antepone in testa al blocco "Catalogo use case" un'istruzione testuale che spiega
 *    al motore esterno come gestire il caso "input non riconosciuto" — classificarlo,
 *    inventare un titolo breve, restituire `USECASE: "NUOVO_<TITOLO>"` come trace.
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
}

/**
 * Istruzione testuale "non riconosciuto" iniettata in testa al blocco catalogo quando
 * `includeLog` è `true`. Tenuta come template costante, in italiano, coerente per stile
 * e tono con {@link PROMPT_HEADER_IT} (lo stesso motore esterno legge entrambi).
 *
 * Formato del trace nuovo intenzionalmente diverso dallo standard `USECASE: "<NOME>"`:
 * il prefisso `NUOVO_` permette al designer (che vede i log runtime) di riconoscere a
 * colpo d'occhio gli use case "non in catalogo" da promuovere in design-time. Tutto in
 * MAIUSCOLO e il nome tra virgolette doppie, allineato al formato del campo `log` nel
 * JSON ({@link buildUseCaseLogValue}).
 */
const PROMPT_LOG_INSTRUCTION_IT = `Logging use case
Per ogni risposta, alla fine del testo restituisci anche il marker dello use case applicato:
- Se hai riconosciuto uno dei casi del catalogo qui sotto, copia letteralmente il valore del campo \`log\` di quello use case (formato: \`USECASE: "<NOME>"\`, tutto MAIUSCOLO, nome tra virgolette doppie).
- Se NESSUN use case del catalogo si applica all'input dell'utente, classificalo tu: scegli un titolo breve in SNAKE_CASE MAIUSCOLO che descriva l'intento, e termina la risposta con \`USECASE: "NUOVO_<TITOLO>"\` (esempio: \`USECASE: "NUOVO_RICHIESTA_RIMBORSO"\`).
- Il marker va sempre alla fine, su nuova riga, senza altre parole prima o dopo.`;

/**
 * Sezione testuale iniziale del prompt: istruzioni operative per il motore esterno.
 *
 * Mantenuta come template costante (non parametrizzata) per garantire identicità della
 * formulazione tra invocazioni e tra istanze: il designer e il motore esterno costruiscono
 * familiarità su una guida fissa. Variazioni intenzionali vanno fatte qui, non al call-site.
 */
function buildUksInstruction(agentBehavior: AgentBehaviorMode): string {
  const base = `Use Case non riconosciuto (UKS)
Se NESSUN use case del catalogo si applica all'input, NON forzare un mapping. Termina la risposta con \`USECASE: "UKS"\` su nuova riga.`;
  switch (agentBehavior) {
    case 'A':
      return `${base}
Comportamento A: rispondi in modo colloquiale libero (fuori dai template del catalogo), poi il marker UKS.`;
    case 'B':
      return `${base}
Comportamento B: rispondi ESATTAMENTE «Non ho capito, può ripetere?» e il marker UKS.`;
    case 'C':
      return `${base}
Comportamento C: al primo tentativo fallito rispondi «Non ho capito, può ripetere?»; al secondo tentativo fallito di seguito comunica che passerai a un operatore umano, poi UKS.`;
    default:
      return base;
  }
}

const PROMPT_HEADER_IT = `Ruolo
Sei l'agente virtuale di un servizio fissato dal progettista. Devi parlare e rispondere ESCLUSIVAMENTE come definito dalla lista di use case che ti vengono forniti più sotto, in formato JSON.

Regole obbligatorie
1. Per ogni interazione, scegli UN solo use case dalla lista. Usa UNA delle sue \`variants\`: il campo \`tokenizedExample\` è il template; rispetta \`when\` per scegliere la variante corretta (se una sola variante, usala).
2. Dentro il catalogo NON inventare frasi: sostituisci SOLO gli slot. Fuori catalogo (UKS) vale la sezione UKS sotto.
3. Gli slot tra parentesi quadre (es. \`[prestazione]\`, \`[data]\`, \`[formulaconferma]\`) vanno sostituiti con valori coerenti. \`[formulaconferma]\` e slot linguistici simili: scegli una formula dalla lista \`linguisticVariants\` del registry se fornita.
4. NON lasciare parentesi quadre visibili nella risposta finale.
5. Mantieni tono e struttura fissa del \`tokenizedExample\`; non riformulare le parole fuori dagli slot.
6. Usa \`scenario\` per decidere QUANDO applicare l'use case.
7. Il campo \`label\` è interno; non citarlo.

Catalogo use case (JSON)
Ogni voce ha \`variants[]\` (sempre almeno una). Ogni variante ha \`tokenizedExample\`, \`tokens\`, opzionale \`when\`.`;

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
  if (!areAllUseCasesProjectable(useCases)) {
    throw new Error(
      'buildConversationalPrompt: almeno uno use case non ha un messaggio agente canonico compilabile.'
    );
  }

  const includeLog = options.includeLog === true;
  const agentBehavior = options.agentBehavior ?? 'B';
  const projected = projectAllUseCasesToConversationalJson(useCases, { includeLog });

  /**
   * Layout del catalogo:
   *   ### Use case 1
   *   {
   *     "useCaseId": "…",
   *     …
   *   }
   *
   *   ### Use case 2
   *   {
   *     …
   *   }
   *
   * Lo header `### Use case N` è puramente visuale (markdown-friendly e leggibile in chat
   * box): non sostituisce informazione presente nel JSON, serve solo come ancora di lettura
   * per il designer che incolla il prompt e vuole orientarsi tra i blocchi.
   */
  const catalogBlocks = projected.map(
    (uc, index) =>
      `### Use case ${index + 1}\n${JSON.stringify(uc, null, 2)}`
  );

  /**
   * Quando `includeLog` è attivo, l'istruzione testuale di logging va **in testa al blocco
   * Catalogo use case** (non nello header generale): è semanticamente legata al catalogo
   * — descrive cosa fare con i campi `log` che il motore vede subito dopo. Tenerla qui
   * invece che in {@link PROMPT_HEADER_IT} mantiene quest'ultimo stabile per i task che
   * non usano il logging.
   */
  const uksBlock = buildUksInstruction(agentBehavior);
  const catalogSection = includeLog
    ? `${PROMPT_LOG_INSTRUCTION_IT}\n\n${uksBlock}\n\n${catalogBlocks.join('\n\n')}`
    : `${uksBlock}\n\n${catalogBlocks.join('\n\n')}`;

  const rulesSection = buildConversationalRulesPromptSection(
    options.conversationalRules ?? []
  );
  const body = rulesSection.trim()
    ? `${catalogSection}\n\n${rulesSection}`
    : catalogSection;
  return `${PROMPT_HEADER_IT}\n\n${body}\n`;
}
