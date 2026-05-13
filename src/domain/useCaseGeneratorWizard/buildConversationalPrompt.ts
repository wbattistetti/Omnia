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
import type { AIAgentUseCase } from '@types/aiAgentUseCases';

/**
 * Opzioni di build del prompt finale. `includeLog`:
 *  - inietta nel JSON di ogni use case il campo `log: "Usecase: <label>"` (vedi
 *    {@link projectAllUseCasesToConversationalJson});
 *  - antepone in testa al blocco "Catalogo use case" un'istruzione testuale che spiega
 *    al motore esterno come gestire il caso "input non riconosciuto" — classificarlo,
 *    inventare un titolo breve, restituire `Usecase: nuovo_<titolo>` come trace.
 *
 * Default `false` (back-compat): i task gi\u00e0 pubblicati continuano a generare lo stesso
 * prompt di prima finch\u00e9 il designer non attiva il toggle "Logga Use Case" dal menu Upload.
 */
export interface BuildConversationalPromptOptions {
  readonly includeLog?: boolean;
}

/**
 * Istruzione testuale "non riconosciuto" iniettata in testa al blocco catalogo quando
 * `includeLog` è `true`. Tenuta come template costante, in italiano, coerente per stile
 * e tono con {@link PROMPT_HEADER_IT} (lo stesso motore esterno legge entrambi).
 *
 * Formato del trace nuovo intenzionalmente diverso da `Usecase: <label>`: il prefisso
 * `nuovo_` permette al designer (che vede i log runtime) di riconoscere a colpo d'occhio
 * gli use case "non in catalogo" da promuovere in design-time.
 */
const PROMPT_LOG_INSTRUCTION_IT = `Logging use case
Per ogni risposta, alla fine del testo restituisci anche il marker dello use case applicato:
- Se hai riconosciuto uno dei casi del catalogo qui sotto, copia letteralmente il valore del campo \`log\` di quello use case (formato: \`Usecase: <nome>\`).
- Se NESSUN use case del catalogo si applica all'input dell'utente, classificalo tu: scegli un titolo breve in snake_case che descriva l'intento, e termina la risposta con \`Usecase: nuovo_<titolo>\` (esempio: \`Usecase: nuovo_richiesta_rimborso\`).
- Il marker va sempre alla fine, su nuova riga, senza altre parole prima o dopo.`;

/**
 * Sezione testuale iniziale del prompt: istruzioni operative per il motore esterno.
 *
 * Mantenuta come template costante (non parametrizzata) per garantire identicità della
 * formulazione tra invocazioni e tra istanze: il designer e il motore esterno costruiscono
 * familiarità su una guida fissa. Variazioni intenzionali vanno fatte qui, non al call-site.
 */
const PROMPT_HEADER_IT = `Ruolo
Sei l'agente virtuale di un servizio fissato dal progettista. Devi parlare e rispondere ESCLUSIVAMENTE come definito dalla lista di use case che ti vengono forniti più sotto, in formato JSON.

Regole obbligatorie
1. Per ogni interazione, scegli UN solo use case dalla lista e usa il suo \`tokenizedExample\` come template della tua risposta.
2. NON inventare frasi: se l'utente esce dai casi previsti, riconducilo educatamente dentro uno degli use case del catalogo.
3. I segmenti tra parentesi quadre nel template (es. \`[data]\`, \`[orario]\`, \`[importo]\`) sono SLOT. Devi sostituirli con i valori effettivi al momento della risposta:
   - \`[data]\` → una data nel formato del dominio (es. «12 giugno»).
   - \`[orario]\` → un orario (es. «09:30»).
   - \`[nome]\`, \`[email]\`, \`[telefono]\`, \`[importo]\`, ecc. → il valore della corrispondente entità.
   - \`[slot]\`, \`[slot1]\`, \`[slot2]\` → valori generici quando il compilatore non può inferire un tipo più specifico.
   - Se lo stesso tipo compare più volte nello stesso template (\`[data1]\`, \`[data2]\`) sono valori distinti coerenti col contesto.
4. NON aggiungere parentesi quadre nella risposta finale: gli slot vanno sostituiti, non lasciati visibili.
5. Mantieni tono, registro e struttura del \`tokenizedExample\`. Non riformulare la frase: sostituisci SOLO gli slot.
6. Usa il campo \`scenario\` di ciascun use case come guida per decidere QUANDO applicarlo.
7. Il campo \`label\` è il nome interno; non citarlo nella risposta all'utente.

Catalogo use case (JSON)
Ogni voce è autonoma. Il campo \`tokenizedExample\` è il template da usare; \`tokens\` elenca gli slot che devi popolare.`;

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
  const catalogSection = includeLog
    ? `${PROMPT_LOG_INSTRUCTION_IT}\n\n${catalogBlocks.join('\n\n')}`
    : catalogBlocks.join('\n\n');

  return `${PROMPT_HEADER_IT}\n\n${catalogSection}\n`;
}
