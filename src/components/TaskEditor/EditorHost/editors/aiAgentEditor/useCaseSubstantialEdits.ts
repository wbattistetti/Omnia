/**
 * Helper per misurare quante "correzioni sostanziali" l'utente ha fatto nei messaggi
 * degli use case rispetto all'ultima baseline IA. Una correzione è "sostanziale" se
 * il numero di parole cambiate (Levenshtein a livello di parola) tra baseline e draft
 * corrente è >= soglia (default 3 — vedi `DEFAULT_SUBSTANTIAL_EDIT_WORD_THRESHOLD`).
 *
 * Granularità di conteggio = singolo campo, non singolo use case: uno scenario e un
 * messaggio agente entrambi corretti contano come 2 (è ciò che l'utente "vede" come
 * lavoro fatto). I campi presi in considerazione sono `scenario` (payoff) e
 * `agentMessage` (assistantContent dell'ultimo turno assistente). Il `label`/titolo è
 * volutamente escluso: è un identificatore corto, non un "messaggio" rifinito.
 *
 * Il conteggio alimenta il callout «Completa correzione» nel pannello DX del wizard.
 *
 * La distanza si calcola sulle **parole significative** (token whitespace dopo strip
 * punteggiatura ai bordi, escluso un elenco di funzioni grammaticali IT/EN comuni) così
 * piccole variazioni su articoli/preposizioni non attivano il gate. La soglia N è
 * configurabile via `VITE_AGENT_SUBSTANTIAL_EDIT_WORD_THRESHOLD` (intero ≥ 1).
 *
 * Le funzioni sono pure e indipendenti da React: testabili in isolamento.
 */
import type { AiTripletFieldBaseline } from './useCaseComposerPresentation';

/** Soglia minima di "parole cambiate" oltre la quale una modifica è considerata sostanziale. */
export const DEFAULT_SUBSTANTIAL_EDIT_WORD_THRESHOLD = 3;

/** Env Vite (solo prefisso `VITE_` è esposto al client). */
export const SUBSTANTIAL_EDIT_WORD_THRESHOLD_ENV_KEY = 'VITE_AGENT_SUBSTANTIAL_EDIT_WORD_THRESHOLD';

/**
 * Articoli, preposizioni e congiunzioni frequenti (IT + EN) escluse dal conteggio
 * «significativo». Non è un tokenizer morfologico: evita falsi positivi grossolani.
 */
const FUNCTION_WORDS = new Set(
  [
    'il',
    'lo',
    'la',
    'i',
    'gli',
    'le',
    'un',
    'uno',
    'una',
    "un'",
    "un’",
    'e',
    'ed',
    'o',
    'oppure',
    'ma',
    'però',
    'pero',
    'di',
    'del',
    'della',
    'dei',
    'delle',
    'allo',
    'alla',
    'ai',
    'agli',
    'alle',
    'dal',
    'dallo',
    'dalla',
    'dai',
    'dagli',
    'dalle',
    'nel',
    'nello',
    'nella',
    'nei',
    'negli',
    'nelle',
    'sul',
    'sullo',
    'sulla',
    'sui',
    'sugli',
    'sulle',
    'col',
    'coi',
    'al',
    'allo',
    'alla',
    'ai',
    'agli',
    'alle',
    'a',
    'da',
    'in',
    'con',
    'su',
    'per',
    'tra',
    'fra',
    'che',
    'non',
    'se',
    'come',
    'si',
    'ci',
    'vi',
    'ne',
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'of',
    'to',
    'in',
    'on',
    'at',
    'by',
    'for',
    'from',
    'with',
    'as',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'it',
    'this',
    'that',
    'these',
    'those',
  ].map((w) => w.toLowerCase())
);

function stripEdgePunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}]+$/u, '');
}

/**
 * Risolve la soglia N da env (build-time Vite) o default. Valori non numerici o &lt; 1 → default.
 */
export function resolveSubstantialEditWordThreshold(): number {
  try {
    const raw =
      typeof import.meta !== 'undefined' && import.meta.env
        ? String((import.meta.env as Record<string, string | undefined>)[SUBSTANTIAL_EDIT_WORD_THRESHOLD_ENV_KEY] ?? '')
            .trim()
        : '';
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  } catch {
    /* import.meta assente (test non-Vite) */
  }
  return DEFAULT_SUBSTANTIAL_EDIT_WORD_THRESHOLD;
}

/**
 * Soglia di **visibilità** del callout «Completa correzione» nel pannello DX:
 * il callout appare quando il numero di campi sostanzialmente modificati raggiunge
 * questo valore. Separata dalla soglia di "parole cambiate" (intra-campo): con `1`
 * basta un solo scenario o messaggio agente sostanzialmente diverso dalla baseline
 * perché il designer veda la CTA, anche mentre il testo è ancora in bozza (textarea).
 */
export const COMPLETE_CORRECTION_VISIBILITY_THRESHOLD = 1;

/**
 * `true` quando il callout «Completa correzione» deve occupare il pannello tutorial
 * (sostituendo la review card): soglia raggiunta e non dismissato, oppure propagazione
 * in corso (`correctionsBusy` — il callout resta finché l’operazione non termina).
 */
export function isCompletaCorrezioneCalloutSurfaceActive(state: {
  readonly pendingCorrectionsCount: number;
  readonly correctionsDismissed: boolean;
  readonly correctionsBusy: boolean;
}): boolean {
  const overThreshold =
    state.pendingCorrectionsCount >= COMPLETE_CORRECTION_VISIBILITY_THRESHOLD &&
    !state.correctionsDismissed;
  return overThreshold || state.correctionsBusy;
}

/**
 * Tokenizza il testo a livello di parola: split su whitespace e filtro dei vuoti.
 * Punteggiatura resta attaccata alla parola (es. "ciao!" è una parola sola): è una
 * scelta voluta — basta come metrica grossolana per "quante parole sono cambiate"
 * dal punto di vista percettivo, senza dover importare un tokenizer linguistico.
 */
export function tokenizeWords(text: string): readonly string[] {
  return text.split(/\s+/u).filter((w) => w.length > 0);
}

/**
 * Token per il confronto sostanziale: come {@link tokenizeWords} ma senza funzioni grammaticali.
 */
export function tokenizeSignificantWords(text: string): readonly string[] {
  return tokenizeWords(text)
    .map((w) => stripEdgePunctuation(w).toLowerCase())
    .filter((w) => w.length > 0 && !FUNCTION_WORDS.has(w));
}

/**
 * Distanza di edit a livello di parola (Levenshtein classico, costo unitario).
 * Complessità O(n*m); accettabile per messaggi UI (decine di parole). Per messaggi
 * più lunghi resta veloce: il bottleneck percepito sarebbe comunque il rerender, non
 * questo calcolo. Implementazione "two-row" per ridurre allocazioni.
 */
export function wordEditDistance(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * `true` se la modifica del singolo campo è "sostanziale" (≥ `threshold` parole cambiate).
 * `baseline === undefined` significa "nessuna baseline IA registrata": in questo caso
 * NON consideriamo l'edit come sostanziale (non c'è nulla con cui confrontare; sarebbe
 * inflate counting al primo render dopo la generazione).
 */
export function isSubstantialEdit(
  current: string,
  baseline: string | undefined,
  threshold: number = resolveSubstantialEditWordThreshold()
): boolean {
  if (baseline === undefined) return false;
  if (current === baseline) return false;
  const distance = wordEditDistance(
    tokenizeSignificantWords(current),
    tokenizeSignificantWords(baseline)
  );
  return distance >= threshold;
}

/** Contributo di un singolo use case al conteggio (0..N). */
export type SubstantialEditFields = {
  scenario: boolean;
  agentMessage: boolean;
};

export function fieldsWithSubstantialEdits(
  current: { scenario: string; agentMessage: string },
  baseline: AiTripletFieldBaseline | undefined,
  threshold: number = resolveSubstantialEditWordThreshold()
): SubstantialEditFields {
  return {
    scenario: isSubstantialEdit(current.scenario, baseline?.payoff, threshold),
    agentMessage: isSubstantialEdit(current.agentMessage, baseline?.assistantContent, threshold),
  };
}

/**
 * Conta quanti **campi** (scenario / messaggio agente) sono sostanzialmente modificati
 * lungo l'intera lista di use case. Usato dal callout DX «Completa correzione»
 * (visibile quando count >= soglia visiva, vedi `COMPLETE_CORRECTION_VISIBILITY_THRESHOLD`).
 */
export function countSubstantialEditsAcrossUseCases(
  items: ReadonlyArray<{
    id: string;
    current: { scenario: string; agentMessage: string };
    baseline: AiTripletFieldBaseline | undefined;
  }>,
  threshold: number = resolveSubstantialEditWordThreshold()
): number {
  let count = 0;
  for (const item of items) {
    const f = fieldsWithSubstantialEdits(item.current, item.baseline, threshold);
    if (f.scenario) count += 1;
    if (f.agentMessage) count += 1;
  }
  return count;
}
