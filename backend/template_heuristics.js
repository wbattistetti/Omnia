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
 * Scores a composite template based on how many mainData fields are mentioned.
 * @param {Object} template - Composite template dictionary
 * @param {string[]} mentionedFields - List of template names mentioned in description
 * @returns {number} Score: Number of mainData fields that match mentionedFields
 */
function scoreCompositeTemplate(template, mentionedFields) {
  const mainData = template.mainData || [];
  if (!mainData.length) {
    return 0;
  }

  let score = 0;
  for (const mainItem of mainData) {
    const templateRef = mainItem.templateRef || mainItem.type;
    if (templateRef && mentionedFields.includes(templateRef)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Calculates score for a template (atomic or composite).
 * @param {Object} template - Template dictionary
 * @param {string[]} mentionedFields - List of template names mentioned in description
 * @returns {number} Score: Number of matched fields
 */
function scoreTemplate(template, mentionedFields) {
  const templateType = template.type || 'atomic';

  if (templateType === 'composite') {
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

  // First pass: look for composite templates that contain ALL mentioned fields
  for (const [templateName, template] of Object.entries(templates)) {
    const templateType = template.type || 'atomic';

    if (templateType === 'composite') {
      const mainData = template.mainData || [];
      if (!mainData.length) {
        continue;
      }

      // Extract template references from mainData
      const mainDataRefs = [];
      for (const mainItem of mainData) {
        const ref = mainItem.templateRef || mainItem.type;
        if (ref) {
          mainDataRefs.push(ref);
        }
      }

      // Check if composite contains all mentioned fields
      const containsAll = mentionedFields.every(field => mainDataRefs.includes(field));
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
        const templateType = template.type || 'atomic';
        if (templateType === 'composite') {
          bestReason = `Composite template matches ${score} fields`;
        } else {
          bestReason = `Atomic template matches ${score} field(s)`;
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
  const templateType = template.type || 'atomic';

  if (templateType === 'composite') {
    // For composite, resolve mainData references
    const mainDataList = [];
    const mainData = template.mainData || [];

    for (const mainItem of mainData) {
      const templateRef = mainItem.templateRef || mainItem.type;
      const isMentioned = templateRef ? mentionedFields.includes(templateRef) : false;

      // Resolve referenced template if exists
      if (templateRef && templatesDict[templateRef]) {
        const refTemplate = templatesDict[templateRef];
        // Deep copy subData to preserve stepPrompts on each item
        const subDataWithPrompts = (refTemplate.subData || []).map(sub => {
          const hasStepPrompts = !!(sub.stepPrompts && typeof sub.stepPrompts === 'object' && Object.keys(sub.stepPrompts).length > 0);
          if (hasStepPrompts) {
            console.log(`[HEURISTIC][buildResponse] ✅ Preserving sub-data stepPrompts for ${sub.label || 'unknown'} in ${templateRef}`);
          }
          return {
            ...sub,
            // Preserve stepPrompts if present
            stepPrompts: sub.stepPrompts || undefined
          };
        });
        mainDataList.push({
          label: refTemplate.label || templateRef,
          type: refTemplate.type || templateRef,
          icon: refTemplate.icon || 'FileText',
          subData: subDataWithPrompts,
          required: isMentioned,
          // Include stepPrompts from referenced template
          stepPrompts: refTemplate.stepPrompts || null
        });
      } else {
        // Direct mainData entry
        // Deep copy subData to preserve stepPrompts on each item
        const subDataWithPrompts = (mainItem.subData || []).map(sub => {
          const hasStepPrompts = !!(sub.stepPrompts && typeof sub.stepPrompts === 'object' && Object.keys(sub.stepPrompts).length > 0);
          if (hasStepPrompts) {
            console.log(`[HEURISTIC][buildResponse] ✅ Preserving sub-data stepPrompts for ${sub.label || 'unknown'} in direct mainData entry`);
          }
          return {
            ...sub,
            // Preserve stepPrompts if present
            stepPrompts: sub.stepPrompts || undefined
          };
        });
        mainDataList.push({
          label: mainItem.label || templateRef || 'Data',
          type: templateRef || mainItem.type || 'generic',
          icon: mainItem.icon || 'FileText',
          subData: subDataWithPrompts,
          required: isMentioned,
          // Include stepPrompts from mainItem if present
          stepPrompts: mainItem.stepPrompts || null
        });
      }
    }

    return {
      type: 'object',
      icon: template.icon || 'Folder',
      schema: {
        label: template.label || 'Data',
        mainData: mainDataList,
        // Include stepPrompts from composite template if present
        stepPrompts: template.stepPrompts || null
      }
    };
  } else {
    // For atomic, return single mainData entry
    // Deep copy subData to preserve stepPrompts on each item
    const subDataWithPrompts = (template.subData || []).map(sub => {
      const hasStepPrompts = !!(sub.stepPrompts && typeof sub.stepPrompts === 'object' && Object.keys(sub.stepPrompts).length > 0);
      if (hasStepPrompts) {
        console.log(`[HEURISTIC][buildResponse] ✅ Preserving sub-data stepPrompts for ${sub.label || 'unknown'} in atomic template ${template.label || template.name || 'unknown'}`);
      }
      return {
        ...sub,
        // Preserve stepPrompts if present
        stepPrompts: sub.stepPrompts || undefined
      };
    });
    return {
      type: 'object',
      icon: template.icon || 'FileText',
      schema: {
        label: template.label || 'Data',
        mainData: [{
          label: template.label || 'Data',
          type: template.type || template.name || 'generic',
          icon: template.icon || 'FileText',
          subData: subDataWithPrompts,
          // Include stepPrompts from atomic template
          stepPrompts: template.stepPrompts || null
        }],
        // Include stepPrompts at schema level too for consistency
        stepPrompts: template.stepPrompts || null
      }
    };
  }
}

module.exports = {
  extractMentionedFields,
  findBestTemplateMatch,
  buildHeuristicResponse,
  scoreTemplate,
  scoreAtomicTemplate,
  scoreCompositeTemplate
};

