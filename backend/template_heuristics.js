/**
 * Template Heuristics Module (JavaScript port)
 * Deterministic pattern matching for DDT template selection.
 * Uses synonyms and field matching to select templates without AI.
 */

/**
 * Extracts template names mentioned in the description using synonyms.
 * @param {string} text - User description (e.g., "chiedi nome e telefono")
 * @param {Object} templates - Dictionary of available templates {name: template}
 * @returns {string[]} List of template names that were mentioned
 */
function extractMentionedFields(text, templates) {
  if (!text || !templates) {
    console.log('[HEURISTIC][extractMentionedFields] Empty input', { hasText: !!text, hasTemplates: !!templates });
    return [];
  }

  const textLower = text.toLowerCase().trim();
  const mentioned = [];
  const seen = new Set();

  console.log('[HEURISTIC][extractMentionedFields] Starting', { text, textLower, templatesCount: Object.keys(templates).length });

  // Build pattern/synonym map and check matches
  for (const [templateName, template] of Object.entries(templates)) {
    const label = (template.label || '').toLowerCase();
    const templateNameLower = templateName.toLowerCase();
    let matched = false;

    // PRIORITY 1: Use patterns if available (same structure as Task_Types)
    const patterns = template.patterns;
    if (patterns && typeof patterns === 'object' && !Array.isArray(patterns)) {
      // Try target language first, then fallback to other languages
      const targetLang = 'IT'; // Could be passed as parameter
      const langPatterns = patterns[targetLang] || patterns.IT || patterns.EN || patterns.PT;

      if (Array.isArray(langPatterns)) {
        for (const patternStr of langPatterns) {
          try {
            // Pattern is already a regex string with word boundaries
            const pattern = new RegExp(patternStr, 'i');
            if (pattern.test(textLower)) {
              console.log('[HEURISTIC][extractMentionedFields] ✅ Pattern match found', {
                templateName,
                pattern: patternStr,
                textLower
              });
              if (!seen.has(templateName)) {
                seen.add(templateName);
                mentioned.push(templateName);
              }
              matched = true;
              break;
            }
          } catch (e) {
            // Invalid regex, skip
            console.warn('[HEURISTIC][extractMentionedFields] Invalid pattern regex', { templateName, pattern: patternStr, error: e.message });
            continue;
          }
        }
      }
    }

    // PRIORITY 2: Fallback to synonyms (backward compatibility)
    if (!matched) {
      const synonymsRaw = template.synonyms || [];

      // ✅ Support multilingual synonyms: {it: [...], en: [...], pt: [...]} or simple array
      let allSynonyms = [];
      if (Array.isArray(synonymsRaw)) {
        // Legacy format: simple array
        allSynonyms = [...synonymsRaw];
      } else if (typeof synonymsRaw === 'object' && synonymsRaw !== null) {
        // New format: multilingual object
        const supportedLangs = ['it', 'en', 'pt', 'IT', 'EN', 'PT'];
        for (const lang of supportedLangs) {
          if (Array.isArray(synonymsRaw[lang])) {
            allSynonyms.push(...synonymsRaw[lang]);
          }
        }
      }

      // Add template name and label as fallback synonyms
      allSynonyms = [...allSynonyms, templateNameLower, label].filter(s => s);

      console.log('[HEURISTIC][extractMentionedFields] Checking template (synonyms fallback)', {
        templateName,
        synonymsRaw,
        synonymsType: Array.isArray(synonymsRaw) ? 'array' : typeof synonymsRaw,
        allSynonyms,
        label
      });

      for (const synonym of allSynonyms) {
        const synonymLower = String(synonym).toLowerCase().trim();
        if (!synonymLower) continue;

        // Use word boundaries for exact matching
        const pattern = new RegExp(`\\b${synonymLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const matches = pattern.test(textLower);

        if (matches) {
          console.log('[HEURISTIC][extractMentionedFields] ✅ Synonym match found', {
            templateName,
            synonym,
            synonymLower,
            pattern: pattern.toString(),
            textLower
          });
          if (!seen.has(templateName)) {
            seen.add(templateName);
            mentioned.push(templateName);
          }
          break; // Found match for this template, move to next
        }
      }
    }
  }

  console.log('[HEURISTIC][extractMentionedFields] Result', { mentioned });
  return mentioned;
}

/**
 * Scores an atomic template based on mentioned fields.
 * @param {Object} template - Template dictionary
 * @param {string[]} mentionedFields - List of template names mentioned in description
 * @returns {number} Score: 1 if template is mentioned, 0 otherwise
 */
function scoreAtomicTemplate(template, mentionedFields) {
  const templateName = template.name || '';
  return mentionedFields.includes(templateName) ? 1 : 0;
}

/**
 * Scores a composite template based on how many subDataIds are mentioned.
 * @param {Object} template - Composite template dictionary
 * @param {string[]} mentionedFields - List of template names mentioned in description
 * @returns {number} Score: Number of subDataIds that match mentionedFields
 */
function scoreCompositeTemplate(template, mentionedFields) {
  const subDataIds = template.subDataIds || [];
  if (!subDataIds.length) {
    return 0;
  }

  let score = 0;
  for (const subId of subDataIds) {
    if (mentionedFields.includes(subId)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Calculates score for a template (simple or composite).
 * @param {Object} template - Template dictionary
 * @param {string[]} mentionedFields - List of template names mentioned in description
 * @returns {number} Score: Number of matched fields
 */
function scoreTemplate(template, mentionedFields) {
  const subDataIds = template.subDataIds || [];

  // ✅ Template composito se ha subDataIds
  if (subDataIds.length > 0) {
    return scoreCompositeTemplate(template, mentionedFields);
  } else {
    return scoreAtomicTemplate(template, mentionedFields);
  }
}

/**
 * Finds the best template match using heuristic scoring.
 * Priority:
 * 1. Composite templates that contain all mentioned fields
 * 2. Template with highest score
 *
 * @param {string} text - User description
 * @param {Object} templates - Dictionary of available templates
 * @param {string[]} [mentionedFields] - Pre-extracted mentioned fields (optional)
 * @returns {Object|null} Object with {template, score, reason} or null if no match
 */
function findBestTemplateMatch(text, templates, mentionedFields = null) {
  if (!text || !templates) {
    console.log('[HEURISTIC][findBestTemplateMatch] Empty input', { hasText: !!text, hasTemplates: !!templates });
    return null;
  }

  // Extract mentioned fields if not provided
  if (!mentionedFields) {
    mentionedFields = extractMentionedFields(text, templates);
  }

  console.log('[HEURISTIC][findBestTemplateMatch] Mentioned fields extracted', { mentionedFields, count: mentionedFields.length });

  if (!mentionedFields.length) {
    console.log('[HEURISTIC][findBestTemplateMatch] No mentioned fields found, returning null');
    return null;
  }

  let bestTemplate = null;
  let bestScore = 0;
  let bestReason = '';

  // First pass: look for composite templates (subDataIds.length > 0) that contain ALL mentioned fields
  for (const [templateName, template] of Object.entries(templates)) {
    const subDataIds = template.subDataIds || [];

    // ✅ Template composito se ha subDataIds
    if (subDataIds.length > 0) {
      // Check if composite contains all mentioned fields
      const containsAll = mentionedFields.every(field => subDataIds.includes(field));
      if (containsAll) {
        const score = mentionedFields.length;
        if (score > bestScore) {
          bestTemplate = template;
          bestScore = score;
          bestReason = `Composite template contains all ${mentionedFields.length} mentioned fields`;
        }
      }
    }
  }

  // Second pass: find template with highest score (if no perfect composite match)
  if (!bestTemplate) {
    for (const [templateName, template] of Object.entries(templates)) {
      const score = scoreTemplate(template, mentionedFields);
      if (score > bestScore) {
        bestTemplate = template;
        bestScore = score;
        const subDataIds = template.subDataIds || [];
        if (subDataIds.length > 0) {
          bestReason = `Composite template matches ${score} fields`;
        } else {
          bestReason = `Simple template matches ${score} field(s)`;
        }
      }
    }
  }

  if (bestTemplate && bestScore > 0) {
    return { template: bestTemplate, score: bestScore, reason: bestReason };
  }

  return null;
}

/**
 * Builds response structure from matched template.
 * For composite templates, resolves templateRef and marks non-mentioned fields as optional.
 *
 * @param {Object} template - Matched template
 * @param {string[]} mentionedFields - Fields mentioned in user description
 * @param {Object} templatesDict - Dictionary of all available templates (for resolving references)
 * @param {string} [targetLang='it'] - Target language for localization
 * @returns {Object} Response structure compatible with step2 format
 */
function buildHeuristicResponse(template, mentionedFields, templatesDict, targetLang = 'it') {
  // ✅ NUOVA STRUTTURA: Usa subDataIds invece di mainData
  const subDataIds = template.subDataIds || [];
  const mainDataList = [];

  if (subDataIds.length > 0) {
    // ✅ Template composito: crea istanza principale + istanze per ogni sottodato referenziato
    console.log('[HEURISTIC][buildResponse] 📦 Template composito, creando istanze per sottodati', {
      templateLabel: template.label || template.name,
      subDataIds,
      count: subDataIds.length
    });

    // ✅ PRIMA: Costruisci array di subData instances
    // Per ogni ID in subDataIds, cerca il template corrispondente e crea una sotto-istanza
    // NOTA: Un template alla radice non sa se sarà usato come sottodato o come main,
    // quindi può avere tutti i 6 tipi di stepPrompts (start, noMatch, noInput, confirmation, notConfirmed, success).
    // Quando lo usiamo come sottodato, filtriamo e prendiamo solo start, noInput, noMatch.
    // Ignoriamo confirmation, notConfirmed, success anche se presenti nel template sottodato.
    const subDataInstances = [];

    for (const subId of subDataIds) {
      // ✅ Cerca template per ID (può essere _id, id, name, o label)
      const subTemplate = templatesDict[subId] ||
                         Object.values(templatesDict).find((t) =>
                           t._id === subId || t.id === subId || t.name === subId || t.label === subId
                         );

      if (subTemplate) {
        const isMentioned = mentionedFields.includes(subId) ||
                           mentionedFields.includes(subTemplate.name) ||
                           mentionedFields.includes(subTemplate.label);

        // ✅ Filtra stepPrompts: solo start, noInput, noMatch per sottodati
        // Ignora confirmation, notConfirmed, success anche se presenti nel template sottodato
        const filteredStepPrompts = {};
        if (subTemplate.stepPrompts) {
          if (subTemplate.stepPrompts.start) {
            filteredStepPrompts.start = subTemplate.stepPrompts.start;
          }
          if (subTemplate.stepPrompts.noInput) {
            filteredStepPrompts.noInput = subTemplate.stepPrompts.noInput;
          }
          if (subTemplate.stepPrompts.noMatch) {
            filteredStepPrompts.noMatch = subTemplate.stepPrompts.noMatch;
          }
          // ❌ Ignoriamo: confirmation, notConfirmed, success
        }

        // ✅ Usa la label del template trovato (non l'ID!)
        const subInstance = {
          label: subTemplate.label || subTemplate.name || 'Sub',
          type: subTemplate.type || subTemplate.name || 'generic',
          icon: subTemplate.icon || 'FileText',
          stepPrompts: Object.keys(filteredStepPrompts).length > 0 ? filteredStepPrompts : null,
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          examples: subTemplate.examples || [],
          subData: [],
          required: isMentioned
        };
        subDataInstances.push(subInstance);
        console.log('[HEURISTIC][buildResponse] ✅ Creata istanza sottodato', {
          subId, // ID usato per cercare
          label: subInstance.label, // Label trovata nel template
          hasStepPrompts: Object.keys(filteredStepPrompts).length > 0,
          filteredSteps: Object.keys(filteredStepPrompts)
        });
      } else {
        console.warn('[HEURISTIC][buildResponse] ⚠️ Template sottodato non trovato per ID', { subId });
      }
    }

    // ✅ POI: Crea UN SOLO mainData con subData[] popolato (non elementi separati!)
    // L'istanza principale copia TUTTI i stepPrompts dal template (tutti e 6 i tipi)
    const mainInstance = {
      label: template.label || template.name || 'Data',
      type: template.type || template.name || 'generic',
      icon: template.icon || 'Calendar',
      stepPrompts: template.stepPrompts || null, // ✅ Tutti e 6 i tipi per main
      constraints: template.dataContracts || template.constraints || [],
      examples: template.examples || [],
      subData: subDataInstances, // ✅ Sottodati QUI dentro subData[], non in mainDataList[]
      required: true
    };
    mainDataList.push(mainInstance); // ✅ UN SOLO elemento in mainDataList
  } else {
    // ✅ Template semplice: crea istanza dal template root
    console.log('[HEURISTIC][buildResponse] 📄 Template semplice, creando istanza root', {
      templateLabel: template.label || template.name
    });
    const mainInstance = {
      label: template.label || template.name || 'Data',
      type: template.type || template.name || 'generic',
      icon: template.icon || 'FileText',
      stepPrompts: template.stepPrompts || null,
      constraints: template.dataContracts || template.constraints || [],
      examples: template.examples || [],
      subData: [],
      required: true
    };
    mainDataList.push(mainInstance);
  }

  return {
    type: 'object',
    icon: template.icon || 'FileText',
    schema: {
      label: template.label || 'Data',
      mainData: mainDataList,
      // Include stepPrompts a livello schema se presente
      stepPrompts: template.stepPrompts || null
    }
  };
}

module.exports = {
  extractMentionedFields,
  findBestTemplateMatch,
  buildHeuristicResponse,
  scoreTemplate,
  scoreAtomicTemplate,
  scoreCompositeTemplate
};

