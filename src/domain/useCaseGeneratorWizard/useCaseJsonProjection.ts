/**
 * Proiezione deterministica use case → JSON conversazionale.
 *
 * Questo è il modello dati che il motore esterno (ElevenLabs, ChatGPT, …) deve usare come
 * unica fonte di verità per ciascun use case nel «conversational prompt» finale. Mantenere il
 * formato MOLTO asciutto è intenzionale: ogni campo presente nel JSON è informazione che il
 * motore deve OBBLIGATORIAMENTE consumare; nessuna ridondanza, nessun duplicato.
 *
 * Decisioni di design:
 *  - `tokenizedExample` è IL canale runtime per la frase compilata. Non viene persistito come
 *    fonte autonoma: si deriva sempre dal canonico `dialogue[0].content`, dove il designer
 *    racchiude i valori variabili tra quadre (`[15 giugno]`, `[09:30]`).
 *  - `tokens` riporta i nomi dei placeholder esattamente come compaiono in `tokenizedExample`
 *    (es. `["data1", "data2"]` se sono numerati), così il motore può fare un lookup 1:1 senza
 *    interpretare gli indici.
 *  - Niente `assistantExample` (frase canonica con valori reali): è un esempio illustrativo che
 *    appartiene al design-time, non al runtime contract. Il motore deve generare i valori, non
 *    copiare quelli del designer.
 *  - Niente metadata di runtime (motor_snapshot, slots, groups): quel modello è legacy ConvAI;
 *    qui si usa il modello inline puro derivato dalla tokenizzazione Step 3.
 *
 * Pure function: niente effetti laterali, niente clipboard, niente JSON.stringify (lo fa il
 * chiamante in base al contesto di rendering — Monaco vuole l'oggetto, il prompt builder
 * vuole la stringa). Testabile in isolamento.
 */

import { extractTokenNames } from './tokenizedText';
import { autoTokenizeAnnotated, type AutoTokenizeBracket } from './tokenTypeInference';
import { ensureUseCasePhrases } from '../useCaseBundle/migrateUseCase';
import { compilePhraseVariant } from '../useCaseBundle/semanticCompile';
import { buildParametricWhenClause } from '../useCaseBundle/parametricPhraseHelpers';
import { emptyProjectSlotLexicon, type ProjectSlotLexicon } from '../useCaseBundle/projectSlotLexicon';
import type { AIAgentPhraseVariant } from '../useCaseBundle/schema';
import {
  getAssistantExample,
  isUseCaseIncludedInConversations,
  type AIAgentUseCase,
} from '@types/aiAgentUseCases';

/** Variante deploy (schema v2 prompt conversazionale). */
export interface UseCaseConversationalVariantJson {
  variantId: string;
  phraseId?: string;
  tokenizedExample: string;
  tokens: string[];
  when?: string;
}

/**
 * Forma JSON di un singolo use case nel «prompt conversazionale» esposto al motore esterno.
 * Schema v2: sempre `variants[]` (anche con una sola voce).
 */
export interface UseCaseConversationalJson {
  useCaseId: string;
  label: string;
  scenario: string;
  variants: UseCaseConversationalVariantJson[];
  log?: string;
}

/**
 * Opzioni del proiettore. `includeLog: true` aggiunge il campo `log` nel JSON con il
 * formato `USECASE: "<NOME>"` (label MAIUSCOLA, virgolette doppie) — vedi
 * `Task.agentLogUseCase` e {@link UseCaseConversationalJson.log}. Default: `false` (back-compat).
 */
export interface ProjectUseCaseOptions {
  readonly includeLog?: boolean;
  /** Lessico progetto per compile on-the-fly se manca snapshot su variante. */
  readonly lexicon?: ProjectSlotLexicon;
}

/**
 * Costruisce il valore del campo `log` per uno use case. Esportato (anche se single-line)
 * perché il compositore del system prompt — quando inietta l'istruzione "non riconosciuto"
 * — deve mostrare lo stesso formato come esempio inline: tenerlo qui evita drift tra il
 * JSON e la documentazione testuale.
 *
 * Formato: `USECASE: "<NOME>"`. Sia `USECASE` sia il nome sono in MAIUSCOLO; il nome è
 * racchiuso in virgolette doppie. Il `toLocaleUpperCase()` (senza locale esplicita) usa
 * la locale di default del runtime; per Omnia il prompt è in italiano e la upper-case
 * standard ECMA è già corretta per i caratteri latini IT.
 */
export function buildUseCaseLogValue(label: string): string {
  return `USECASE: "${label.trim().toLocaleUpperCase()}"`;
}

export interface UseCaseConversationalCompilation {
  /** Testo canonico visibile al designer, con valori literal tra quadre. */
  naturalText: string;
  /** Testo runtime derivato dal canonical: i literal tra quadre diventano placeholder. */
  tokenizedText: string;
  /** Token deduplicati in ordine di apparizione, coerenti con `tokenizedText`. */
  tokens: string[];
  /** Dettaglio dei bracket processati dal compilatore deterministico. */
  brackets: AutoTokenizeBracket[];
  /**
   * Avvisi non bloccanti da mostrare nel pannello nastro. Il JSON resta generabile: questi
   * warning servono al designer per correggere il testo canonico se la marcatura non è chiara.
   */
  warnings: string[];
}

function uniqueTokensFromTokenizedText(tokenizedText: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const name of extractTokenNames(tokenizedText)) {
    if (seen.has(name)) continue;
    seen.add(name);
    tokens.push(name);
  }
  return tokens;
}

function buildCompilationWarnings(naturalText: string, brackets: AutoTokenizeBracket[]): string[] {
  const warnings: string[] = [];
  if (naturalText.includes('[') || naturalText.includes(']')) {
    const opens = (naturalText.match(/\[/g) ?? []).length;
    const closes = (naturalText.match(/\]/g) ?? []).length;
    if (opens !== closes) {
      warnings.push('Parentesi quadre non bilanciate: correggi il testo naturale.');
    }
    if (/\[[^\]]*\[/.test(naturalText)) {
      warnings.push('Parentesi quadre annidate: usa un solo livello di marcatura.');
    }
  }
  if (brackets.length === 0 && naturalText.trim().length > 0) {
    warnings.push('Nessun valore tra quadre: il template non avrà slot runtime.');
  }
  const fallbackCount = brackets.filter((b) => b.confidence === 'fallback').length;
  if (fallbackCount > 0) {
    warnings.push(
      fallbackCount === 1
        ? 'Un valore è stato compilato come [slot]: verifica se serve un nome più specifico.'
        : `${fallbackCount} valori sono stati compilati come [slotN]: verifica se servono nomi più specifici.`
    );
  }
  return warnings;
}

/**
 * Compila la frase canonica dello use case nella forma runtime usata dal prompt/JSON.
 * Fonte unica: `dialogue[0].content`. I campi legacy `assistant_example_tokenized*`, se presenti,
 * non partecipano alla proiezione per evitare divergenze.
 */
export function compileUseCaseConversationalText(
  uc: AIAgentUseCase,
  lexicon: ProjectSlotLexicon = emptyProjectSlotLexicon()
): UseCaseConversationalCompilation | null {
  const withPhrases = ensureUseCasePhrases(uc);
  const phrase = withPhrases.phrases?.[0];
  const variant = phrase?.variants?.[0];
  if (!phrase || !variant) {
    const naturalText = getAssistantExample(uc).trim();
    if (!naturalText) return null;
    const compiled = autoTokenizeAnnotated(naturalText);
    const tokenizedText = compiled.tokenized.trim();
    if (!tokenizedText) return null;
    return {
      naturalText,
      tokenizedText,
      tokens: uniqueTokensFromTokenizedText(tokenizedText),
      brackets: compiled.brackets,
      warnings: buildCompilationWarnings(naturalText, compiled.brackets),
    };
  }
  const naturalText =
    (typeof variant.naturalText === 'string' && variant.naturalText.trim()) ||
    phrase.naturalText.trim();
  if (!naturalText) return null;
  const snap =
    variant.compiled?.status === 'fresh'
      ? variant.compiled
      : compilePhraseVariant(phrase, variant, lexicon);
  const tokenizedText = snap.tokenizedText.trim();
  if (!tokenizedText) return null;
  const warnings = buildCompilationWarnings(naturalText, []);
  if (snap.mappings.some((m) => m.slot_id === 'slot')) {
    warnings.push('Un valore è stato compilato come [slot]: verifica il lessico progetto.');
  }
  return {
    naturalText,
    tokenizedText,
    tokens: snap.tokens,
    brackets: [],
    warnings,
  };
}

function variantNaturalForDeploy(
  phrase: { naturalText: string },
  variant: AIAgentPhraseVariant
): string {
  if (typeof variant.naturalText === 'string' && variant.naturalText.trim()) {
    return variant.naturalText.trim();
  }
  return phrase.naturalText.trim();
}

function collectVariantProjections(
  uc: AIAgentUseCase,
  lexicon: ProjectSlotLexicon
): UseCaseConversationalVariantJson[] {
  const withPhrases = ensureUseCasePhrases(uc);
  const out: UseCaseConversationalVariantJson[] = [];
  for (const phrase of withPhrases.phrases ?? []) {
    const param = phrase.parametric;
    if (
      param?.enabled &&
      param.dimensions.length > 0 &&
      param.rows.some((r) => typeof r.promptNaturalText === 'string' && r.promptNaturalText.trim())
    ) {
      const defaultVariant = phrase.variants.find((v) => v.variantId === 'default') ?? phrase.variants[0];
      if (defaultVariant) {
        const naturalDef = variantNaturalForDeploy(phrase, defaultVariant);
        if (naturalDef) {
          const snap =
            defaultVariant.compiled?.tokenizedText?.trim()
              ? defaultVariant.compiled
              : compilePhraseVariant(phrase, defaultVariant, lexicon);
          if (snap.tokenizedText.trim()) {
            out.push({
              variantId: 'default',
              phraseId: phrase.phraseId,
              tokenizedExample: snap.tokenizedText,
              tokens: snap.tokens,
            });
          }
        }
      }
      let paramIdx = 0;
      for (const prow of param.rows) {
        const prompt = prow.promptNaturalText?.trim();
        if (!prompt) continue;
        const when = buildParametricWhenClause(param.dimensions, prow.valuesByDimensionId);
        const vid = `param_${++paramIdx}`;
        const rowVariant: AIAgentPhraseVariant = {
          variantId: vid,
          naturalText: prompt,
          ...(when.trim() ? { when: when.trim() } : {}),
        };
        const snap = compilePhraseVariant(phrase, rowVariant, lexicon);
        if (!snap.tokenizedText.trim()) continue;
        out.push({
          variantId: vid,
          phraseId: phrase.phraseId,
          tokenizedExample: snap.tokenizedText,
          tokens: snap.tokens,
          ...(when.trim() ? { when: when.trim() } : {}),
        });
      }
      continue;
    }

    for (const variant of phrase.variants) {
      const hasOwnTemplate =
        typeof variant.naturalText === 'string' && variant.naturalText.trim().length > 0;
      /** Varianti strutturali senza testo proprio sono bozze: non duplicare il template default nel prompt. */
      if (variant.variantId !== 'default' && !hasOwnTemplate) continue;

      const natural = variantNaturalForDeploy(phrase, variant);
      if (!natural) continue;
      const snap =
        variant.compiled?.tokenizedText?.trim()
          ? variant.compiled
          : compilePhraseVariant(phrase, variant, lexicon);
      if (!snap.tokenizedText.trim()) continue;
      out.push({
        variantId: variant.variantId,
        phraseId: phrase.phraseId,
        tokenizedExample: snap.tokenizedText,
        tokens: snap.tokens,
        ...(typeof variant.when === 'string' && variant.when.trim()
          ? { when: variant.when.trim() }
          : {}),
      });
    }
  }
  return out;
}

/**
 * Indica se uno use case ha almeno una variante deployabile con testo non vuoto.
 */
export function isUseCaseProjectable(
  uc: AIAgentUseCase,
  lexicon: ProjectSlotLexicon = emptyProjectSlotLexicon()
): boolean {
  return collectVariantProjections(uc, lexicon).length > 0;
}

/**
 * Proietta uno use case nella forma JSON conversazionale. Restituisce `null` se lo use case
 * non è proiettabile (frase tokenizzata mancante/vuota). Pattern «fail-explicit» coerente con
 * le regole del progetto: niente fallback silenziosi.
 *
 * @param uc lo use case sorgente, già normalizzato (campi presenti come da {@link AIAgentUseCase}).
 * @param options vedi {@link ProjectUseCaseOptions}.
 */
export function projectUseCaseToConversationalJson(
  uc: AIAgentUseCase,
  options: ProjectUseCaseOptions = {}
): UseCaseConversationalJson | null {
  const lexicon = options.lexicon ?? emptyProjectSlotLexicon();
  const variants = collectVariantProjections(uc, lexicon);
  if (variants.length === 0) return null;

  const scenario = typeof uc.payoff === 'string' ? uc.payoff.trim() : '';
  const label = typeof uc.label === 'string' ? uc.label.trim() : '';

  const projected: UseCaseConversationalJson = {
    useCaseId: uc.id,
    label,
    scenario,
    variants,
  };
  if (options.includeLog === true) {
    projected.log = buildUseCaseLogValue(label);
  }
  return projected;
}

/**
 * Versione batch: proietta tutti gli use case proiettabili in ordine di catalogo (sort_order
 * crescente, fallback su label per stabilità). Use case non proiettabili sono saltati. Per il
 * pulsante «Crea prompt conversazionale» il chiamante deve verificare separatamente che TUTTI
 * gli use case siano proiettabili (vedi {@link areAllUseCasesProjectable}).
 *
 * **Filtro inclusione**: gli use case con `included_in_conversations === false` (toggle nell'header
 * della lista) vengono esclusi dalla proiezione. Il motore esterno non deve vederli n\u00e9
 * applicarli, restano per\u00f2 nel catalogo design-time per non essere ri-proposti come duplicati
 * dall'IA. Vedi {@link isUseCaseIncludedInConversations}.
 */
export function projectAllUseCasesToConversationalJson(
  useCases: readonly AIAgentUseCase[],
  options: ProjectUseCaseOptions = {}
): UseCaseConversationalJson[] {
  const sorted = [...useCases]
    .filter(isUseCaseIncludedInConversations)
    .sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return (a.label ?? '').localeCompare(b.label ?? '', undefined, { sensitivity: 'base' });
    });
  const out: UseCaseConversationalJson[] = [];
  for (const uc of sorted) {
    const projected = projectUseCaseToConversationalJson(uc, options);
    if (projected) out.push(projected);
  }
  return out;
}

/**
 * True solo se TUTTI gli use case **inclusi** del catalogo sono proiettabili (e ce n'\u00e8 almeno
 * uno incluso). Usato per la visibilit\u00e0 del pulsante «Crea prompt conversazionale» in toolbar:
 * il prompt deve essere completo per essere utile al motore esterno. Use case esclusi non
 * partecipano alla validazione (l'utente li ha tolti consapevolmente di mezzo).
 */
export function areAllUseCasesProjectable(
  useCases: readonly AIAgentUseCase[],
  lexicon: ProjectSlotLexicon = emptyProjectSlotLexicon()
): boolean {
  const included = useCases.filter(isUseCaseIncludedInConversations);
  if (included.length === 0) return false;
  for (const uc of included) {
    if (!isUseCaseProjectable(uc, lexicon)) return false;
  }
  return true;
}

/**
 * Restituisce la stringa JSON formattata (indent 2) della proiezione, oppure stringa vuota se
 * non proiettabile. Helper per i call site che vogliono solo la stringa (es. Monaco editor,
 * clipboard copy).
 */
export function stringifyUseCaseConversationalJson(
  uc: AIAgentUseCase,
  options: ProjectUseCaseOptions = {}
): string {
  const projected = projectUseCaseToConversationalJson(uc, options);
  if (!projected) return '';
  return JSON.stringify(projected, null, 2);
}
