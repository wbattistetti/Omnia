/**
 * Template Heuristics Module (JavaScript port)
 * Deterministic pattern matching for DDT template selection.
 * Uses synonyms and field matching to select templates without AI.
 */

/**
 * Estrae steps da un template e li filtra per sub-tasks (solo start, noInput, noMatch)
 *
 * @param {Object} template - Template con steps
 * @param {string} templateId - ID del template
 * @returns {Object|undefined} Steps filtrati per sub-tasks o undefined
 */
function extractFilteredStepsForSubTask(template, templateId) {
  if (!template || !template.steps || typeof template.steps !== 'object') {
    return undefined;
  }

  const nodeId = templateId || template.id || template._id;
  if (!nodeId) {
    return undefined;
  }

  const nodeSteps = template.steps[String(nodeId)];
  if (!nodeSteps || typeof nodeSteps !== 'object') {
    return undefined;
  }

  // Filtra solo start, noInput, noMatch per sub-tasks
  const filteredSteps = {};
  const allowedStepTypes = ['start', 'noInput', 'noMatch'];

  for (const stepType of allowedStepTypes) {
    if (nodeSteps[stepType]) {
      filteredSteps[stepType] = nodeSteps[stepType];
    }
  }

  if (Object.keys(filteredSteps).length === 0) {
    return undefined;
  }

  return {
    [String(nodeId)]: filteredSteps
  };
}

/**
 * Extracts template names mentioned in the description using synonyms.
 * @param {string} text - User description (e.g., "chiedi nome e telefono")
 * @param {Object} templates - Dictionary of available templates {name: template}
 * @param {Object} [patternMemory] - PatternMemoryService memory (optional, for loading synonyms from Translations)
 * @returns {string[]} List of template names that were mentioned
 */
function extractMentionedFields(text, templates, patternMemory = null) {
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
    // Patterns sono regex, quindi li usiamo direttamente per matching
    const patterns = template.patterns;
    if (patterns && typeof patterns === 'object' && !Array.isArray(patterns)) {
      // Try target language first, then fallback to other languages
      // TODO: Passare targetLang come parametro invece di hardcoded
      const targetLang = 'IT'; // Could be passed as parameter
      const langPatterns = patterns[targetLang] || patterns.IT || patterns.EN || patterns.PT;

      if (Array.isArray(langPatterns)) {
        for (const patternStr of langPatterns) {
          try {
            // Pattern è già una regex string con word boundaries
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

    // PRIORITY 2: Use synonyms from Translations (via patternMemory) or fallback to template.synonyms
    if (!matched) {
      let allSynonyms = [];

      // ✅ PRIORITY 2a: Try to load synonyms from Translations (new approach)
      if (patternMemory && patternMemory.templatePatterns) {
        // Cerca il GUID del template (può essere id, _id, o name usato come GUID)
        const templateGuid = template.id || template._id || templateName;

        // Carica sinonimi dalla memory (usa direttamente templatePatterns Map)
        const memorySynonyms = patternMemory.templatePatterns.get(templateGuid) || [];
        if (memorySynonyms && memorySynonyms.length > 0) {
          allSynonyms = [...memorySynonyms];
          console.log('[HEURISTIC][extractMentionedFields] ✅ Sinonimi caricati da Translations', {
            templateName,
            templateGuid,
            synonymsCount: allSynonyms.length
          });
        }
      }

      // ✅ PRIORITY 2b: Fallback to template.synonyms (backward compatibility)
      if (allSynonyms.length === 0) {
        const synonymsRaw = template.synonyms || [];

        // Support multilingual synonyms: {it: [...], en: [...], pt: [...]} or simple array
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
      }

      // Add template name and label as fallback synonyms
      allSynonyms = [...allSynonyms, templateNameLower, label].filter(s => s);

      // Get template GUID for logging
      const templateGuid = template.id || template._id || templateName;
      const hasMemorySynonyms = patternMemory && patternMemory.templatePatterns ?
        (patternMemory.templatePatterns.get(templateGuid)?.length > 0) : false;

      console.log('[HEURISTIC][extractMentionedFields] Checking template (synonyms)', {
        templateName,
        synonymsCount: allSynonyms.length,
        allSynonyms: allSynonyms.slice(0, 5), // Show first 5 only
        label,
        fromMemory: hasMemorySynonyms
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
 * @param {string[]} mentionedFields - List of template IDs (GUIDs) mentioned in description
 * @returns {number} Score: 1 if template is mentioned, 0 otherwise
 */
function scoreAtomicTemplate(template, mentionedFields) {
  // ✅ Usa ID (GUID) invece di name
  const templateId = template.id || template._id || template.name || '';
  return mentionedFields.includes(templateId) ? 1 : 0;
}

/**
 * Scores a composite template based on how many subDataIds are mentioned.
 * @param {Object} template - Composite template dictionary
 * @param {string[]} mentionedFields - List of template IDs (GUIDs) mentioned in description
 * @returns {number} Score: Number of subDataIds that match mentionedFields
 */
function scoreCompositeTemplate(template, mentionedFields) {
  const subDataIds = template.subDataIds || [];
  if (!subDataIds.length) {
    return 0;
  }

  let score = 0;
  for (const subId of subDataIds) {
    // ✅ mentionedFields contiene già i GUID, quindi confronto diretto
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
function findBestTemplateMatch(text, templates, mentionedFields = null, patternMemory = null) {
  if (!text || !templates) {
    console.log('[HEURISTIC][findBestTemplateMatch] Empty input', { hasText: !!text, hasTemplates: !!templates });
    return null;
  }

  // Extract mentioned fields if not provided
  if (!mentionedFields) {
    mentionedFields = extractMentionedFields(text, templates, patternMemory);
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
  for (const [templateKey, template] of Object.entries(templates)) {
    const subDataIds = template.subDataIds || [];
    const templateId = template.id || template._id || templateKey;

    // ✅ Template composito se ha subDataIds
    if (subDataIds.length > 0) {
      // Check if composite contains all mentioned fields (mentionedFields contiene GUID)
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
    for (const [templateKey, template] of Object.entries(templates)) {
      const templateId = template.id || template._id || templateKey;

      // ✅ Verifica se questo template stesso è menzionato (per template semplici)
      const isMentioned = mentionedFields.includes(templateId);

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
    // quindi può avere tutti i 6 tipi di steps (start, noMatch, noInput, confirmation, notConfirmed, success).
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

        // ✅ Estrai steps filtrati per sub-tasks (solo start, noInput, noMatch)
        const subTemplateId = subTemplate.id || subTemplate._id || subId;
        const filteredSteps = extractFilteredStepsForSubTask(subTemplate, subTemplateId);

        // ✅ Usa la label del template trovato (non l'ID!)
        const subInstance = {
          label: subTemplate.label || subTemplate.name || 'Sub',
          type: subTemplate.type || subTemplate.name || 'generic',
          icon: subTemplate.icon || 'FileText',
          steps: filteredSteps || undefined, // ✅ Usa steps invece di steps
          constraints: subTemplate.dataContracts || subTemplate.constraints || [],
          examples: subTemplate.examples || [],
          subData: [],
          required: isMentioned
        };
        subDataInstances.push(subInstance);
        console.log('[HEURISTIC][buildResponse] ✅ Creata istanza sottodato', {
          subId, // ID usato per cercare
          label: subInstance.label, // Label trovata nel template
          hasSteps: !!filteredSteps,
          stepsKeys: filteredSteps ? Object.keys(filteredSteps) : []
        });
      } else {
        console.warn('[HEURISTIC][buildResponse] ⚠️ Template sottodato non trovato per ID', { subId });
      }
    }

    // ✅ POI: Crea UN SOLO mainData con subData[] popolato (non elementi separati!)
    // L'istanza principale copia TUTTI gli steps dal template (tutti i tipi)
    const mainTemplateId = template.id || template._id;
    const mainInstance = {
      label: template.label || template.name || 'Data',
      type: template.type || template.name || 'generic',
      icon: template.icon || 'Calendar',
      steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
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
    const mainTemplateId = template.id || template._id;
    const mainInstance = {
      label: template.label || template.name || 'Data',
      type: template.type || template.name || 'generic',
      icon: template.icon || 'FileText',
      steps: mainTemplateId && template.steps ? { [String(mainTemplateId)]: template.steps[String(mainTemplateId)] } : undefined, // ✅ Usa steps invece di steps
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
      mainData: mainDataList
      // ❌ RIMOSSO: steps - usa steps nei nodi invece
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

