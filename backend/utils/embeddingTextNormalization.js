// Please write clean, production-grade JavaScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

/**
 * Text normalization for embedding matching
 *
 * This module provides a unified normalization function that:
 * - Extracts VERB + DATA TYPE from natural language text
 * - Removes context-specific information (e.g., "del paziente", "del titolare")
 * - Ensures consistent embedding generation for both templates and queries
 *
 * Architecture:
 * - Single source of truth for embedding text normalization
 * - Used when generating embeddings for templates (backend)
 * - Should match the normalization logic in frontend EmbeddingService.ts
 *
 * Examples:
 * - "chiedi il cognome del paziente ricoverato" → "chiedi cognome"
 * - "per favore richiedi la data di nascita del titolare" → "richiedi data di nascita"
 * - "chiedi la data di nascita del paziente" → "chiedi data di nascita"
 */

/**
 * Pattern (schemas) for normalization to extract VERB + DATA TYPE
 * Extensible structure: add new patterns here
 */
const normalizationPatterns = [
  {
    name: 'chiedi_tipo_dato',
    verbPattern: '(chiedi|richiedi|domanda|chiedere|richiedere|domandare)',
    objectPattern: '(cognome|nome|data|telefono|indirizzo|email|codice|numero|cap|capitale|capitale sociale|partita iva|cf|codice fiscale|piva|partita iva|ragione sociale|indirizzo|via|civico|cap|comune|provincia|regione|nazione|paese|stato|data di nascita|giorno|mese|anno|età|sesso|genere|professione|lavoro|occupazione)',
    contextPrepositions: '(di|del|della|dei|degli|delle|al|allo|alla|ai|agli|alle|per|sul|sulla|sui|sugli|sulle|riguardo|relativo|relativi|relativa|relative|of|from|for|about|regarding)'
  }
  // TODO: Add more patterns in the future:
  // - 'inserisci_tipo_dato'
  // - 'verifica_tipo_dato'
  // - 'conferma_tipo_dato'
  // etc.
];

/**
 * Apply a specific normalization pattern
 * @param {string} text - Text to normalize
 * @param {Object} pattern - Pattern to apply
 * @returns {string|null} Normalized text or null if pattern doesn't match
 */
function applyNormalizationPattern(text, pattern) {
  // 1. Check if text starts with the verb pattern
  const verbRegex = new RegExp(`^${pattern.verbPattern}`, 'i');
  const verbMatch = text.match(verbRegex);
  if (!verbMatch) {
    return null;
  }

  const verb = verbMatch[0];
  const afterVerb = text.substring(verb.length).trim();

  // 2. Remove optional article
  const afterArticle = afterVerb.replace(/^(il|lo|la|l'|un|uno|una|un'|the|a|an)\s+/i, '');

  // 3. Find the first contextual preposition
  const prepositionRegex = new RegExp(`\\s+${pattern.contextPrepositions}\\s+`, 'i');
  const prepositionMatch = afterArticle.match(prepositionRegex);

  let objectText;
  if (prepositionMatch && prepositionMatch.index !== undefined) {
    // Extract only what comes before the preposition
    objectText = afterArticle.substring(0, prepositionMatch.index).trim();
  } else {
    // No preposition found, use everything after the article
    objectText = afterArticle.trim();
  }

  // 4. Check if the extracted object matches the object pattern
  const objectRegex = new RegExp(`^${pattern.objectPattern}`, 'i');
  const objectMatch = objectText.match(objectRegex);
  if (!objectMatch) {
    return null;
  }

  // 5. Reconstruct: verb + object (use the matched object to preserve multi-word objects like "data di nascita")
  const matchedObject = objectMatch[0];
  const normalized = `${verb} ${matchedObject}`.trim();

  return normalized;
}

/**
 * Advanced text normalization for embedding matching
 * Uses pattern-based extraction to get VERB + DATA TYPE
 *
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeTextForEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return text || '';
  }

  let normalized = text.toLowerCase().trim();
  const originalText = normalized;

  // 1. Remove courtesy prefixes
  normalized = normalized.replace(/^(per favore|please|gentilmente|kindly|vorrei|i would like)\s+/i, '');

  // 2. Remove duplicate verbs at the beginning
  normalized = normalized.replace(/^(chiedi|chiedere|richiedi|richiedere|domanda)\s+(chiedi|chiedere|richiedi|richiedere|domanda)\s+/i, '$1 ');

  // 3. Try each normalization pattern
  let matchedPattern = null;
  for (const pattern of normalizationPatterns) {
    const result = applyNormalizationPattern(normalized, pattern);
    if (result !== null) {
      normalized = result;
      matchedPattern = pattern.name;
      break; // First matching pattern wins
    }
  }

  // 4. Fallback: if no pattern matched, apply basic normalization
  if (matchedPattern === null) {
    // Basic cleanup: remove articles and normalize spaces
    normalized = normalized.replace(/^(il|lo|la|l'|un|uno|una|un'|the|a|an)\s+/i, '');
    normalized = normalized.replace(/\s+/g, ' ').trim();
  }

  // 5. Final cleanup: normalize multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // 6. Log normalization result (only if it changed)
  if (normalized !== originalText) {
    console.log('[embeddingTextNormalization] 🔄 Text normalized for embedding', {
      original: originalText.substring(0, 80),
      normalized: normalized.substring(0, 80),
      pattern: matchedPattern || 'fallback'
    });
  }

  return normalized;
}

/**
 * Find verb at start of text (for V-X-Y segmentation)
 * @param {string} text - Text to search
 * @param {string} language - Language code
 * @returns {Object|null} Object with verb and end index, or null
 */
function findVerbAtStart(text, language = 'IT') {
  const REQUEST_VERBS = {
    IT: ['chiedi', 'richiedi', 'domanda', 'chiedere', 'richiedere', 'domandare', 'mi dici', 'vorrei sapere', 'serve sapere', 'quando è', 'dimmi', 'quale è', 'qual è'],
    EN: ['ask', 'request', 'tell me', 'i want to know', 'i need to know', 'when is', 'what is', 'which is', 'give me'],
    PT: ['pergunte', 'solicite', 'me diga', 'quero saber', 'preciso saber', 'quando é', 'qual é', 'o que é'],
    ES: ['pide', 'solicita', 'dime', 'quiero saber', 'necesito saber', 'cuándo es', 'cuál es', 'qué es'],
    FR: ['demande', 'solicite', 'dis-moi', 'je veux savoir', 'j\'ai besoin de savoir', 'quand est', 'quel est', 'qu\'est-ce que'],
    DE: ['frage', 'bitte', 'sag mir', 'ich möchte wissen', 'ich brauche zu wissen', 'wann ist', 'was ist', 'welches ist']
  };

  const verbs = REQUEST_VERBS[language] || REQUEST_VERBS['IT'];
  if (!verbs || verbs.length === 0) {
    return null;
  }

  const lowerText = text.toLowerCase();
  const sortedVerbs = [...verbs].sort((a, b) => b.length - a.length);

  for (const verb of sortedVerbs) {
    if (lowerText.startsWith(verb.toLowerCase())) {
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
 * @param {string} text - Text to clean
 * @param {string} language - Language code
 * @returns {string} Text without leading article
 */
function removeLeadingArticle(text, language = 'IT') {
  const ARTICLES = {
    IT: ['la ', 'il ', 'lo ', 'l\'', 'i ', 'gli ', 'le '],
    EN: ['the ', 'a ', 'an ', 'your ', 'my ', 'his ', 'her ', 'their ', 'our ', 'its '],
    PT: ['a ', 'o ', 'as ', 'os '],
    ES: ['la ', 'el ', 'los ', 'las '],
    FR: ['la ', 'le ', 'les ', 'l\''],
    DE: ['der ', 'die ', 'das ', 'den ', 'dem ', 'des ']
  };

  const articles = ARTICLES[language] || ARTICLES['IT'];
  if (!articles || articles.length === 0) {
    return text;
  }

  const lowerText = text.toLowerCase();
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
 * @param {string} text - Text to clean
 * @param {string} language - Language code
 * @returns {string} Text without context prepositions
 */
function removeContextPrepositions(text, language = 'IT') {
  const contextPrepositions = {
    IT: ['del', 'della', 'dello', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'per', 'sul', 'sulla', 'sui', 'sugli', 'sulle'],
    EN: ['of', 'from', 'for', 'about', 'regarding', 'concerning'],
    PT: ['do', 'da', 'de', 'dos', 'das', 'para', 'sobre'],
    ES: ['del', 'de la', 'de los', 'de las', 'al', 'a la', 'para', 'sobre'],
    FR: ['du', 'de la', 'des', 'au', 'à la', 'aux', 'pour', 'sur'],
    DE: ['des', 'der', 'dem', 'den', 'vom', 'zur', 'zum', 'für', 'über']
  };

  const prepositions = contextPrepositions[language] || contextPrepositions['IT'];
  if (prepositions.length === 0) {
    return text;
  }

  const lowerText = text.toLowerCase();
  let earliestIndex = Infinity;

  for (const prep of prepositions) {
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
 * Segment label into V (intention), X (data type), Y (owner)
 * Architecture: V-X-Y segmentation with Y implicit = user (default)
 *
 * @param {string} label - Full label (e.g., "chiedi la data di nascita del paziente")
 * @param {string} language - Language code
 * @param {string|null} contextOwner - Optional context owner (e.g., "paziente" from dialog context)
 * @returns {Object} V-X-Y segmentation result { V, X, Y, YSource }
 */
function segmentLabelVXY(label, language = 'IT', contextOwner = null) {
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
  let Y = null;
  let YSource = 'implicit_user';

  // 3a. Check for explicit Y (del paziente, della cliente, ecc.)
  const contextPrepositionsMap = {
    IT: ['del', 'della', 'dello', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle'],
    EN: ['of', 'from', 'for', 'about'],
    PT: ['do', 'da', 'de', 'dos', 'das'],
    ES: ['del', 'de la', 'de los', 'de las'],
    FR: ['du', 'de la', 'des'],
    DE: ['des', 'der', 'dem', 'den']
  };

  const contextPrepositions = contextPrepositionsMap[language] || contextPrepositionsMap['IT'];
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
    const possessivePatterns = {
      IT: [/\b(il|la|lo|gli|le)\s+(suo|sua|suoi|sue|loro)\b/i],
      EN: [/\b(his|her|their|your|my)\b/i],
      PT: [/\b(seu|sua|seus|suas|deles|delas)\b/i],
      ES: [/\b(su|sus)\b/i],
      FR: [/\b(son|sa|ses|leur|leurs)\b/i],
      DE: [/\b(sein|seine|ihr|ihre|ihr|ihre)\b/i]
    };

    const patterns = possessivePatterns[language] || possessivePatterns['IT'];
    for (const pattern of patterns) {
      if (pattern.test(afterV)) {
        Y = 'third_person';
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
    for (const prep of contextPrepositions) {
      const escapedY = Y.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\s+${prep}\\s+${escapedY.replace(/\s+/g, '\\s+')}(?:\\s|$)`, 'i');
      X = X.replace(regex, '').trim();
    }
  }

  // Remove possessive pronouns if found
  if (YSource === 'pronoun') {
    const possessivePatterns = {
      IT: [/\b(il|la|lo|gli|le)\s+(suo|sua|suoi|sue|loro)\s+/i],
      EN: [/\b(his|her|their|your|my)\s+/i],
      PT: [/\b(seu|sua|seus|suas|deles|delas)\s+/i],
      ES: [/\b(su|sus)\s+/i],
      FR: [/\b(son|sa|ses|leur|leurs)\s+/i],
      DE: [/\b(sein|seine|ihr|ihre|ihr|ihre)\s+/i]
    };

    const patterns = possessivePatterns[language] || possessivePatterns['IT'];
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

/**
 * Remove verbs from template label (for type=3 templates)
 * Uses V-X-Y segmentation architecture to extract only X (data type)
 * This ensures template embeddings only contain the data part, not the action part
 *
 * Examples:
 * - "Chiedi la data di nascita del paziente" → "Data di nascita"
 * - "Richiedi l'email" → "Email"
 * - "quando è nato il paziente" → "Data di nascita" (X implicit)
 *
 * @param {string} text - Template label
 * @param {string} language - Language code (IT, EN, PT, etc.)
 * @returns {string} X (data type) normalized and capitalized
 */
function removeVerbsFromTemplateLabel(text, language = 'IT') {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return text || '';
  }

  // ✅ Use V-X-Y segmentation to extract X (data type)
  const segmentation = segmentLabelVXY(text, language);

  // Return X (already normalized and capitalized)
  if (segmentation.X && segmentation.X.length > 0) {
    return segmentation.X;
  }

  // Fallback to original if segmentation fails
  return text.trim();
}

module.exports = {
  normalizeTextForEmbedding,
  normalizationPatterns,
  removeVerbsFromTemplateLabel
};
