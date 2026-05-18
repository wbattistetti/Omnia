/**
 * Classificatore DETERMINISTICO del tipo di un token nella frase tokenizzata del Passo 3.
 *
 * Obiettivo: data una stringa "letterale" che il designer ha racchiuso tra parentesi quadre
 * (es. `[12 giugno alle 09:00]` o `[09:00]`), inferire il nome del token interno alla gente
 * virtuale (`data`, `orario`, `email`, …) senza invocare l'LLM. Risposta istantanea, zero
 * costo, predicibile — utile per:
 *   1. live re-classify quando l'utente edita la frase canonica e cambia il modo in cui sono
 *      spezzati i bracket (es. `[12 giugno alle 09:00]` → `[12 giugno] alle [09:00]`);
 *   2. consentire al designer di annotare il testo con il VALORE letterale (`[12 giugno]`)
 *      anziché digitare a mano il nome del token (`[data]`).
 *
 * Output: nome BASE del token (senza numerazione). La numerazione `data1`/`data2` viene
 * applicata da {@link autoTokenizeAnnotated} solo quando lo stesso tipo compare più volte
 * nella stessa frase, in coerenza con la regola del wizard.
 *
 * Limiti dichiarati: l'inferenza è basata su pattern del dominio appuntamenti/dati anagrafici
 * IT. Contenuti semantici di dominio (nomi propri, ruoli, tipi di esame, motivazioni) cadono
 * nel fallback `undefined` e devono essere classificati a monte dall'LLM o rinominati a mano dal
 * designer.
 *
 * Vincoli del nome prodotto: lowercase, prima lettera, poi alfanumerico — coerenti con
 * `TOKEN_NAME_REGEX` di {@link ./tokenizedText.ts}.
 */

/** Nomi base prodotti dal classificatore (senza numerazione). */
export type InferredTokenBaseName =
  | 'orario'
  | 'data'
  | 'email'
  | 'telefono'
  | 'codicefiscale'
  | 'partitaiva'
  | 'importo'
  | 'url'
  | 'numero'
  | 'undefined';

/**
 * Confidenza della classificazione:
 * - `high`: pattern fortemente specifico (orario, email, CF, URL, ISO date…);
 * - `medium`: pattern italiano testuale (data con mese in lettere, weekday);
 * - `low`: pattern numerico generico (`numero` quando nessun pattern più specifico matcha);
 * - `fallback`: nessun pattern ha matchato → assegnato `undefined`.
 */
export type InferenceConfidence = 'high' | 'medium' | 'low' | 'fallback';

export interface InferredToken {
  name: InferredTokenBaseName;
  confidence: InferenceConfidence;
}

/** Mesi italiani in forma completa (case-insensitive in match). */
const IT_MONTHS =
  '(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)';

/** Giorni della settimana italiani (con accento opzionale). */
const IT_WEEKDAYS =
  '(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)';

/**
 * Tabella di classificatori in ordine di priorità (più specifico → più generico).
 *
 * Ogni elemento è una coppia `(regex, name, confidence)`. Il primo match decide.
 * Le regex operano sul contenuto TRIMMATO del bracket, case-insensitive (`i` flag).
 *
 * Nota di design: i pattern hanno `^…$` per evitare match parziali. Un input "12 giugno alle
 * 09:00" matcha il pattern `dataConOrario` (data + orario combinati), classificato come `data`
 * perché lo scopo del token è rappresentare un istante temporale unico — coerente con la regola
 * del wizard «un bracket = un placeholder, anche se contiene più informazioni».
 */
const CLASSIFIERS: ReadonlyArray<{
  re: RegExp;
  name: InferredTokenBaseName;
  confidence: InferenceConfidence;
}> = [
  // ── orario standalone ────────────────────────────────────────────────────────
  // 09:00 / 9:00 / 09:00:30 / 9.00 / "09:00" con eventuale am/pm
  {
    re: /^\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:am|pm)?$/i,
    name: 'orario',
    confidence: 'high',
  },

  // ── data combinata con orario ────────────────────────────────────────────────
  // "12 giugno alle 09:00", "lunedì 12 giugno alle 09:00", "12/06/2025 ore 09:00"
  {
    re: new RegExp(
      `^(?:${IT_WEEKDAYS}\\s+)?(?:\\d{1,2}\\s+${IT_MONTHS}(?:\\s+\\d{2,4})?|\\d{1,2}[\\/-]\\d{1,2}(?:[\\/-]\\d{2,4})?|\\d{4}-\\d{2}-\\d{2})\\s+(?:alle|ore)\\s+\\d{1,2}[:.]\\d{2}(?:[:.]\\d{2})?$`,
      'i'
    ),
    name: 'data',
    confidence: 'high',
  },

  // ── data sola, formato ISO ───────────────────────────────────────────────────
  { re: /^\d{4}-\d{2}-\d{2}$/, name: 'data', confidence: 'high' },

  // ── data sola, formato numerico IT/EU ────────────────────────────────────────
  // 12/06/2025, 12-06-25, 12.06.2025
  {
    re: /^\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?$/,
    name: 'data',
    confidence: 'high',
  },

  // ── data IT con mese in lettere ──────────────────────────────────────────────
  // "12 giugno", "12 giugno 2025", "lunedì 12 giugno", "lunedì 12 giugno 2025"
  {
    re: new RegExp(
      `^(?:${IT_WEEKDAYS}\\s+)?\\d{1,2}\\s+${IT_MONTHS}(?:\\s+\\d{2,4})?$`,
      'i'
    ),
    name: 'data',
    confidence: 'medium',
  },

  // ── solo weekday ─────────────────────────────────────────────────────────────
  // Classificato come `data` perché semanticamente è un giorno della settimana.
  {
    re: new RegExp(`^${IT_WEEKDAYS}$`, 'i'),
    name: 'data',
    confidence: 'medium',
  },

  // ── email ────────────────────────────────────────────────────────────────────
  // Pattern volutamente conservativo (RFC-incompleto, ma sufficiente per copia/incolla umano).
  {
    re: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
    name: 'email',
    confidence: 'high',
  },

  // ── codice fiscale italiano (16 caratteri, formato canonico) ────────────────
  {
    re: /^[A-Z]{6}\d{2}[A-EHLMPRT]\d{2}[A-Z]\d{3}[A-Z]$/i,
    name: 'codicefiscale',
    confidence: 'high',
  },

  // ── partita IVA italiana (11 cifre, eventuale prefisso IT) ───────────────────
  { re: /^(?:IT)?\d{11}$/i, name: 'partitaiva', confidence: 'high' },

  // ── URL ──────────────────────────────────────────────────────────────────────
  { re: /^https?:\/\/\S+$/i, name: 'url', confidence: 'high' },

  // ── importo monetario ────────────────────────────────────────────────────────
  // €123, € 123,45, 123 €, 1.234,56 €, $123, USD 99.99, 99 euro
  {
    re: /^(?:[€$£]\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:[€$£]|eur(?:o)?|usd|gbp))$/i,
    name: 'importo',
    confidence: 'high',
  },

  // ── telefono ─────────────────────────────────────────────────────────────────
  // +39 333 1234567, 333-1234567, 02 1234567, (02) 1234567
  // Requisito: ≥6 cifre totali nel testo, solo caratteri ammissibili.
  {
    re: /^(?=(?:[^\d]*\d){6,})\+?[\d\s().\-/]{6,}$/,
    name: 'telefono',
    confidence: 'high',
  },

  // ── numero puro (fallback numerico, ultimo prima del fallback generico) ─────
  {
    re: /^-?\d+(?:[.,]\d+)?$/,
    name: 'numero',
    confidence: 'low',
  },
];

/**
 * Classifica il contenuto LETTERALE di un singolo bracket.
 *
 * Idempotente: se il contenuto è già un valido token name (es. `data`, `orario1`), restituisce
 * il nome stesso come `high`-confidence — utile a mantenere stabile il valore quando l'utente
 * sta editando una frase mista (alcuni bracket già tokenizzati, altri letterali).
 *
 * @param raw contenuto del bracket SENZA le parentesi quadre.
 * @returns nome base inferito + livello di confidenza.
 */
export function inferTokenType(raw: string): InferredToken {
  if (typeof raw !== 'string') return { name: 'undefined', confidence: 'fallback' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { name: 'undefined', confidence: 'fallback' };

  /**
   * Caso «già tokenizzato»: il bracket contiene un token name valido (lowercase alfanumerico)
   * E corrisponde a una base nota → idempotente.
   *
   * IMPORTANTE: il branch scatta SOLO se la base è in {@link KNOWN_BASES}; in caso contrario
   * (es. `domenica`, `paziente`) cade attraverso ai classificatori semantici. Senza questa
   * guardia, parole italiane lowercase intercettavano qualsiasi pattern semantico più sotto.
   */
  if (/^[a-z][a-z0-9]*$/.test(trimmed)) {
    const baseFromName = stripTrailingIndex(trimmed);
    if (baseFromName === 'slot') {
      return { name: 'undefined', confidence: 'high' };
    }
    if (isKnownBaseName(baseFromName)) {
      return { name: baseFromName, confidence: 'high' };
    }
    /** fall-through ai classifier — `paziente` resta `undefined`, `domenica` diventa `data`. */
  }

  for (const cls of CLASSIFIERS) {
    if (cls.re.test(trimmed)) return { name: cls.name, confidence: cls.confidence };
  }
  return { name: 'undefined', confidence: 'fallback' };
}

/**
 * Rimuove un eventuale suffisso numerico finale (`data1` → `data`, `undefined12` → `undefined`).
 * Lascia invariato il nome se non c'è suffisso numerico.
 */
function stripTrailingIndex(name: string): string {
  return name.replace(/\d+$/u, '');
}

/** Whitelist dei {@link InferredTokenBaseName} per il check «nome noto». */
const KNOWN_BASES: ReadonlySet<string> = new Set<InferredTokenBaseName>([
  'orario',
  'data',
  'email',
  'telefono',
  'codicefiscale',
  'partitaiva',
  'importo',
  'url',
  'numero',
  'undefined',
]);

function isKnownBaseName(name: string): name is InferredTokenBaseName {
  return KNOWN_BASES.has(name);
}

export interface AutoTokenizeBracket {
  /** Contenuto letterale originale del bracket (trimmato). */
  source: string;
  /** Nome base inferito (senza eventuale indice numerico). */
  baseName: InferredTokenBaseName;
  /** Nome finale assegnato (con indice se duplicato nella frase). */
  finalName: string;
  /** Confidenza dell'inferenza (utile per UI/debug). */
  confidence: InferenceConfidence;
}

export interface AutoTokenizeResult {
  /** Frase risultante con i token classificati (es. `… il [data] alle [orario] …`). */
  tokenized: string;
  /** Elenco ordinato dei bracket processati (in ordine di apparizione). */
  brackets: AutoTokenizeBracket[];
  /** True se almeno un bracket ha richiesto la riclassificazione (cioè non era già un token valido). */
  hasReclassified: boolean;
}

/**
 * Trasforma una frase "annotata" — con bracket contenenti VALORI letterali — nella corrispettiva
 * frase tokenizzata.
 *
 * Regole:
 * 1. Ogni `[...]` è classificato via {@link inferTokenType}.
 * 2. La numerazione `data1` / `data2` viene applicata SOLO quando lo stesso `baseName` compare
 *    più di una volta nella stessa frase, in coerenza con la regola del wizard. Quindi: se c'è
 *    una sola `data` → `[data]`; se ce ne sono due → `[data1]` e `[data2]` in ordine di apparizione.
 * 3. Le porzioni di testo fuori dai bracket sono preservate verbatim.
 * 4. Bracket non chiusi (`[…` senza `]`) sono lasciati nel testo come letterali per non rompere
 *    l'input dell'utente — la validazione separata segnala l'errore.
 *
 * @example
 * autoTokenizeAnnotated("Ti propongo [12 giugno] alle [09:00].");
 * // → tokenized: "Ti propongo [data] alle [orario].",
 * //   brackets: [{source: '12 giugno', baseName: 'data', finalName: 'data', confidence: 'medium'},
 * //              {source: '09:00',     baseName: 'orario', finalName: 'orario', confidence: 'high'}]
 *
 * autoTokenizeAnnotated("Tra [12 giugno] e [20 giugno].");
 * // → "Tra [data1] e [data2]." (numerazione su duplicati)
 */
export function autoTokenizeAnnotated(annotated: string): AutoTokenizeResult {
  if (typeof annotated !== 'string') {
    return { tokenized: '', brackets: [], hasReclassified: false };
  }

  const brackets: AutoTokenizeBracket[] = [];
  const segments: Array<{ kind: 'text'; text: string } | { kind: 'bracket'; index: number }> = [];

  let i = 0;
  let buffer = '';
  const flushText = (): void => {
    if (buffer.length > 0) {
      segments.push({ kind: 'text', text: buffer });
      buffer = '';
    }
  };

  while (i < annotated.length) {
    const ch = annotated[i];
    if (ch === '[') {
      const close = annotated.indexOf(']', i + 1);
      if (close === -1) {
        /** Bracket non chiuso: lo conservo come testo letterale, validazione gestita altrove. */
        buffer += annotated.slice(i);
        i = annotated.length;
        break;
      }
      const inner = annotated.slice(i + 1, close);
      const inferred = inferTokenType(inner);
      const idx = brackets.length;
      brackets.push({
        source: inner.trim(),
        baseName: inferred.name,
        finalName: inferred.name,
        confidence: inferred.confidence,
      });
      flushText();
      segments.push({ kind: 'bracket', index: idx });
      i = close + 1;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  flushText();

  applyDuplicateIndexing(brackets);

  const tokenized = segments
    .map((s) => (s.kind === 'text' ? s.text : `[${brackets[s.index].finalName}]`))
    .join('');

  const hasReclassified = brackets.some((b) => b.source !== b.finalName);

  return { tokenized, brackets, hasReclassified };
}

/**
 * Applica la numerazione `data1` / `data2` ai bracket con `baseName` duplicato all'interno
 * dello stesso elenco. Muta `brackets` in place.
 *
 * Algoritmo:
 *  - conta le occorrenze totali per baseName;
 *  - se il count finale è 1, mantiene il `finalName = baseName`;
 *  - se è ≥ 2, riassegna `finalName = baseName + (ordine apparizione)`.
 *
 * In questo modo l'ordine `[data]` → `[data]` quando è unico, oppure `[data1]` `[data2]` quando
 * compare due volte. Pattern coerente con la regola del wizard tokenizzazione.
 */
function applyDuplicateIndexing(brackets: AutoTokenizeBracket[]): void {
  const counts: Record<string, number> = {};
  for (const b of brackets) counts[b.baseName] = (counts[b.baseName] ?? 0) + 1;

  const running: Record<string, number> = {};
  for (const b of brackets) {
    if ((counts[b.baseName] ?? 0) <= 1) {
      b.finalName = b.baseName;
      continue;
    }
    running[b.baseName] = (running[b.baseName] ?? 0) + 1;
    b.finalName = `${b.baseName}${running[b.baseName]}`;
  }
}
