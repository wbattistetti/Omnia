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

module.exports = {
  normalizeTextForEmbedding,
  normalizationPatterns
};
