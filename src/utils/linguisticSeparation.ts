// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Linguistic separation utility for TaskType + Template classification
 *
 * Separates user input into:
 * - Part A (functional): Determines TaskType (verb/action words)
 * - Part B (nominal): Determines Template (data/content words)
 *
 * Uses articles as deterministic separators (language-aware)
 */

export type Language = 'IT' | 'EN' | 'PT' | 'ES' | 'FR' | 'DE';

/**
 * Articles for each language (deterministic separators)
 */
const ARTICLES: Record<Language, string[]> = {
  IT: ['la ', 'il ', 'lo ', 'l\'', 'i ', 'gli ', 'le '],
  EN: ['the ', 'a ', 'an ', 'your ', 'my ', 'his ', 'her ', 'their ', 'our ', 'its '],
  PT: ['a ', 'o ', 'as ', 'os '],
  ES: ['la ', 'el ', 'los ', 'las '],
  FR: ['la ', 'le ', 'les ', 'l\''],
  DE: ['der ', 'die ', 'das ', 'den ', 'dem ', 'des ']
};

/**
 * Common verbs for data requests (used as fallback when no article found)
 */
const REQUEST_VERBS: Record<Language, string[]> = {
  IT: ['chiedi', 'richiedi', 'domanda', 'chiedere', 'richiedere', 'domandare', 'mi dici', 'vorrei sapere', 'serve sapere', 'quando è', 'dimmi', 'quale è', 'qual è'],
  EN: ['ask', 'request', 'tell me', 'i want to know', 'i need to know', 'when is', 'what is', 'which is', 'give me'],
  PT: ['pergunte', 'solicite', 'me diga', 'quero saber', 'preciso saber', 'quando é', 'qual é', 'o que é'],
  ES: ['pide', 'solicita', 'dime', 'quiero saber', 'necesito saber', 'cuándo es', 'cuál es', 'qué es'],
  FR: ['demande', 'solicite', 'dis-moi', 'je veux savoir', 'j\'ai besoin de savoir', 'quand est', 'quel est', 'qu\'est-ce que'],
  DE: ['frage', 'bitte', 'sag mir', 'ich möchte wissen', 'ich brauche zu wissen', 'wann ist', 'was ist', 'welches ist']
};

export interface SeparationResult {
  partA: string;  // Functional part (TaskType)
  partB: string;  // Nominal part (Template)
  method: 'article' | 'verb' | 'fallback';
  articleFound?: boolean;
  verbFound?: boolean;
}

/**
 * V-X-Y Segmentation Result
 * V = Intention/verb (chiedi, verifica, ecc.)
 * X = Data type (data di nascita, indirizzo, ecc.)
 * Y = Owner/titolare (paziente, cliente, null = utente)
 */
export interface VXYSegmentation {
  V: string;  // Intention (chiedi, verifica, quando è nato, ecc.)
  X: string;  // Data type (data di nascita, indirizzo, ecc.)
  Y: string | null;  // Owner (paziente, cliente, null = utente)
  YSource: 'explicit' | 'implicit_user' | 'implicit_context' | 'pronoun';
}

/**
 * Find first article in text (language-aware)
 * @param text - Text to search
 * @param language - Language code
 * @returns Object with index, length, and article found, or null
 */
export function findFirstArticle(
  text: string,
  language: Language
): { index: number; length: number; article: string } | null {
  const articles = ARTICLES[language];
  if (!articles || articles.length === 0) {
    return null;
  }

  const lowerText = text.toLowerCase();
  let earliestIndex = Infinity;
  let earliestArticle = '';
  let earliestLength = 0;

  // ✅ Sort by length (longest first) to match "l'" before "l"
  const sortedArticles = [...articles].sort((a, b) => b.length - a.length);

  for (const article of sortedArticles) {
    const lowerArticle = article.toLowerCase();
    const index = lowerText.indexOf(lowerArticle);

    if (index !== -1 && index < earliestIndex) {
      // ✅ VERIFICA WORD BOUNDARIES: l'articolo deve essere una parola intera
      const beforeChar = index === 0 ? ' ' : lowerText[index - 1];
      const afterIndex = index + lowerArticle.length;
      const afterChar = afterIndex >= lowerText.length ? ' ' : lowerText[afterIndex];

      // ✅ Match valido solo se:
      // - Preceduto da spazio o inizio stringa
      // - Seguito da spazio o fine stringa
      const isValidBoundary =
        (beforeChar === ' ' || index === 0) &&
        (afterChar === ' ' || afterIndex >= lowerText.length);

      if (isValidBoundary) {
        earliestIndex = index;
        earliestArticle = article;
        earliestLength = article.length;
      }
    }
  }

  if (earliestIndex !== Infinity) {
    return {
      index: earliestIndex,
      length: earliestLength,
      article: earliestArticle
    };
  }

  return null;
}

/**
 * Find verb at start of text (fallback when no article found)
 * @param text - Text to search
 * @param language - Language code
 * @returns Object with verb, end index, or null
 */
export function findVerbAtStart(
  text: string,
  language: Language
): { verb: string; end: number } | null {
  const verbs = REQUEST_VERBS[language];
  if (!verbs || verbs.length === 0) {
    return null;
  }

  const lowerText = text.toLowerCase();

  // Sort by length (longest first) to match "mi dici" before "mi"
  const sortedVerbs = [...verbs].sort((a, b) => b.length - a.length);

  for (const verb of sortedVerbs) {
    if (lowerText.startsWith(verb.toLowerCase())) {
      // Check if followed by space or end of string
      const afterVerb = lowerText.slice(verb.length);
      if (afterVerb.length === 0 || afterVerb[0] === ' ') {
        return {
          verb: text.slice(0, verb.length),
          end: verb.length
        };
      }
    }
  }

  return null;
}

/**
 * Remove leading article from text
 * @param text - Text to clean
 * @param language - Language code
 * @returns Text without leading article
 */
export function removeLeadingArticle(
  text: string,
  language: Language
): string {
  const articles = ARTICLES[language];
  if (!articles || articles.length === 0) {
    return text;
  }

  const lowerText = text.toLowerCase();

  // Sort by length (longest first) to match "l'" before "l"
  const sortedArticles = [...articles].sort((a, b) => b.length - a.length);

  for (const article of sortedArticles) {
    if (lowerText.startsWith(article.toLowerCase())) {
      return text.slice(article.length).trim();
    }
  }

  return text;
}

/**
 * Remove context prepositions and everything after them
 * Examples: "data di nascita del paziente" → "data di nascita"
 * @param text - Text to clean
 * @param language - Language code
 * @returns Text without context prepositions
 */
export function removeContextPrepositions(
  text: string,
  language: Language
): string {
  const contextPrepositions: Record<Language, string[]> = {
    IT: ['del', 'della', 'dello', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'per', 'sul', 'sulla', 'sui', 'sugli', 'sulle'],
    EN: ['of', 'from', 'for', 'about', 'regarding', 'concerning'],
    PT: ['do', 'da', 'de', 'dos', 'das', 'para', 'sobre'],
    ES: ['del', 'de la', 'de los', 'de las', 'al', 'a la', 'para', 'sobre'],
    FR: ['du', 'de la', 'des', 'au', 'à la', 'aux', 'pour', 'sur'],
    DE: ['des', 'der', 'dem', 'den', 'vom', 'zur', 'zum', 'für', 'über']
  };

  const prepositions = contextPrepositions[language] || [];
  if (prepositions.length === 0) {
    return text;
  }

  const lowerText = text.toLowerCase();
  let earliestIndex = Infinity;

  for (const prep of prepositions) {
    // Match preposition with word boundaries
    const regex = new RegExp(`\\s+${prep}\\s+`, 'i');
    const match = lowerText.match(regex);
    if (match && match.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }

  if (earliestIndex !== Infinity) {
    return text.slice(0, earliestIndex).trim();
  }

  return text;
}

/**
 * Main separation function: separates text into functional (TaskType) and nominal (Template) parts
 * @param text - User input text
 * @param language - Language code
 * @returns Separation result with partA, partB, and method used
 */
export function separateText(
  text: string,
  language: Language = 'IT'
): SeparationResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      partA: '',
      partB: '',
      method: 'fallback'
    };
  }

  const lowerText = trimmed.toLowerCase();

  // Step 1: Try to find article
  const articleResult = findFirstArticle(trimmed, language);

  if (articleResult) {
    // Article found → split at article
    const partA = trimmed.slice(0, articleResult.index).trim();
    let partB = trimmed.slice(articleResult.index + articleResult.length).trim();

    // Remove leading article from partB (in case of "l'email" → "email")
    partB = removeLeadingArticle(partB, language);

    // Remove context prepositions from partB
    partB = removeContextPrepositions(partB, language);

    return {
      partA,
      partB,
      method: 'article',
      articleFound: true
    };
  }

  // Step 2: Fallback - try to find verb at start
  const verbResult = findVerbAtStart(trimmed, language);

  if (verbResult) {
    const partA = verbResult.verb;
    let partB = trimmed.slice(verbResult.end).trim();

    // Remove leading article from partB
    partB = removeLeadingArticle(partB, language);

    // Remove context prepositions from partB
    partB = removeContextPrepositions(partB, language);

    return {
      partA,
      partB,
      method: 'verb',
      verbFound: true
    };
  }

  // Step 3: Final fallback - use last 2-3 words as partB
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    const partA = words.slice(0, -2).join(' ');
    let partB = words.slice(-2).join(' ');

    // Remove leading article from partB
    partB = removeLeadingArticle(partB, language);

    // Remove context prepositions from partB
    partB = removeContextPrepositions(partB, language);

    return {
      partA,
      partB,
      method: 'fallback'
    };
  }

  // Step 4: Ultimate fallback - partA empty, partB = everything
  let partB = trimmed;
  partB = removeLeadingArticle(partB, language);
  partB = removeContextPrepositions(partB, language);

  return {
    partA: '',
    partB,
    method: 'fallback'
  };
}

/**
 * Segment label into V (intention), X (data type), Y (owner)
 * Architecture: V-X-Y segmentation with Y implicit = user (default)
 *
 * @param label - Full label (e.g., "chiedi la data di nascita del paziente")
 * @param language - Language code
 * @param contextOwner - Optional context owner (e.g., "paziente" from dialog context)
 * @returns V-X-Y segmentation result
 */
export function segmentLabelVXY(
  label: string,
  language: Language = 'IT',
  contextOwner?: string | null
): VXYSegmentation {
  const trimmed = label.trim();
  if (!trimmed) {
    return {
      V: '',
      X: '',
      Y: null,
      YSource: 'implicit_user'
    };
  }

  const lowerText = trimmed.toLowerCase();

  // Step 1: Extract V (intention) - verbs at the start
  const verbResult = findVerbAtStart(trimmed, language);
  const V = verbResult ? verbResult.verb : '';

  // Step 2: Extract remaining text after V
  const afterV = verbResult ? trimmed.slice(verbResult.end).trim() : trimmed;

  // Step 3: Extract Y (owner) - explicit or implicit
  let Y: string | null = null;
  let YSource: 'explicit' | 'implicit_user' | 'implicit_context' | 'pronoun' = 'implicit_user';

  // 3a. Check for explicit Y (del paziente, della cliente, ecc.)
  const contextPrepositionsMap: Record<Language, string[]> = {
    IT: ['del', 'della', 'dello', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle'],
    EN: ['of', 'from', 'for', 'about'],
    PT: ['do', 'da', 'de', 'dos', 'das'],
    ES: ['del', 'de la', 'de los', 'de las'],
    FR: ['du', 'de la', 'des'],
    DE: ['des', 'der', 'dem', 'den']
  };

  const contextPrepositions = contextPrepositionsMap[language] || [];
  for (const prep of contextPrepositions) {
    const regex = new RegExp(`\\s+${prep}\\s+(\\w+(?:\\s+\\w+)*)`, 'i');
    const match = afterV.match(regex);
    if (match && match[1]) {
      Y = match[1].trim();
      YSource = 'explicit';
      break;
    }
  }

  // 3b. Check for possessive pronouns (il suo, la sua, ecc.)
  if (!Y) {
    const possessivePatterns: Record<Language, RegExp[]> = {
      IT: [/\b(il|la|lo|gli|le)\s+(suo|sua|suoi|sue|loro)\b/i],
      EN: [/\b(his|her|their|your|my)\b/i],
      PT: [/\b(seu|sua|seus|suas|deles|delas)\b/i],
      ES: [/\b(su|sus)\b/i],
      FR: [/\b(son|sa|ses|leur|leurs)\b/i],
      DE: [/\b(sein|seine|ihr|ihre|ihr|ihre)\b/i]
    };

    const patterns = possessivePatterns[language] || [];
    for (const pattern of patterns) {
      if (pattern.test(afterV)) {
        Y = 'third_person'; // Generic third person
        YSource = 'pronoun';
        break;
      }
    }
  }

  // 3c. Check context owner (from dialog/project context)
  if (!Y && contextOwner) {
    Y = contextOwner;
    YSource = 'implicit_context';
  }

  // 3d. Default: Y = null (implicit user - lei/tu)
  if (!Y) {
    Y = null;
    YSource = 'implicit_user';
  }

  // Step 4: Extract X (data type) - remove V and Y from label
  let X = afterV;

  // Remove Y if explicit
  if (Y && YSource === 'explicit') {
    // Remove prepositions + Y (match the exact Y we found)
    for (const prep of contextPrepositions) {
      // Escape special regex characters in Y
      const escapedY = Y.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\s+${prep}\\s+${escapedY.replace(/\s+/g, '\\s+')}(?:\\s|$)`, 'i');
      X = X.replace(regex, '').trim();
    }
  }

  // Remove possessive pronouns if found
  if (YSource === 'pronoun') {
    const possessivePatterns: Record<Language, RegExp[]> = {
      IT: [/\b(il|la|lo|gli|le)\s+(suo|sua|suoi|sue|loro)\s+/i],
      EN: [/\b(his|her|their|your|my)\s+/i],
      PT: [/\b(seu|sua|seus|suas|deles|delas)\s+/i],
      ES: [/\b(su|sus)\s+/i],
      FR: [/\b(son|sa|ses|leur|leurs)\s+/i],
      DE: [/\b(sein|seine|ihr|ihre|ihr|ihre)\s+/i]
    };

    const patterns = possessivePatterns[language] || [];
    for (const pattern of patterns) {
      X = X.replace(pattern, '').trim();
    }
  }

  // Remove leading articles from X
  X = removeLeadingArticle(X, language);

  // Remove any remaining context prepositions
  X = removeContextPrepositions(X, language);

  // Capitalize first letter of X
  if (X.length > 0) {
    X = X.charAt(0).toUpperCase() + X.slice(1);
  }

  return {
    V: V.trim(),
    X: X.trim(),
    Y,
    YSource
  };
}
