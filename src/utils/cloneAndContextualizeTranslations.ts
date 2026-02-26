// Please write clean, production-grade TypeScript code.
// Avoid non-ASCII characters, Chinese symbols, or multilingual output.

import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * Clone and Contextualize Translations - New Deterministic Flow
 * ============================================================================
 *
 * This function implements the new deterministic flow for cloning steps and
 * contextualizing translations:
 *
 * 1. Clone all steps (already done)
 * 2. Find all text parameters of sayMessage tasks in escalations
 * 3. For each template GUID, get the text from translations
 * 4. Create a new GUID for each pair and replace in parameter
 * 5. Send all pairs to AI for contextualization
 * 6. Add all pairs returned by AI to translations
 *
 * This flow is more deterministic, complete, and robust than the previous one.
 */

interface TextParam {
  oldGuid: string;
  newGuid: string;
  text: string;
  nodeTemplateId?: string;
  stepType?: string;
  escalationIndex?: number;
}

/**
 * Get translation text from template translations
 */
function getTranslationFromTemplate(
  oldGuid: string,
  projectLocale: string = 'it-IT'
): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const context = (window as any).__projectTranslationsContext;
  if (!context || !context.translations) {
    return null;
  }

  const trans = context.translations[oldGuid];
  if (!trans) {
    return null;
  }

  // Extract text for project locale
  if (typeof trans === 'object') {
    return trans[projectLocale] || trans.en || trans.it || trans.pt || '';
  }

  return String(trans);
}

/**
 * Adapt translations to context using AI
 */
async function adaptTranslationsToContext(
  translations: Array<{ guid: string; text: string }>,
  contextLabel: string,
  templateLabel: string,
  locale: string = 'it'
): Promise<Array<{ guid: string; text: string }>> {
  if (translations.length === 0) {
    return [];
  }

  const provider = localStorage.getItem('omnia.aiProvider') || 'openai';
  const model = localStorage.getItem('omnia.aiModel') || undefined;

  // Normalize contextLabel: extract only descriptive part
  // Example: "Chiedi la data di nascita del paziente" -> "data di nascita del paziente"
  const normalizedContextLabel = contextLabel
    .replace(/^(chiedi|chiedere|richiedi|richiedere)\s+(la|il|lo|gli|le|un|una|uno)\s+/i, '')
    .replace(/^(chiedi|chiedere|richiedi|richiedere)\s+/i, '')
    .trim();

  console.log('[adaptTranslationsToContext] 🚀 Calling AI for contextualization', {
    translationsCount: translations.length,
    contextLabel,
    normalizedContextLabel,
    templateLabel,
    locale,
    provider
  });

  try {
    const response = await fetch('/api/ddt/adapt-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: translations.map(t => ({
          guid: t.guid,
          text: t.text
        })),
        contextLabel: normalizedContextLabel,
        templateLabel,
        locale,
        provider,
        model
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // ✅ FIX: API doesn't return 'success' field, only 'adaptedTranslations'
    // Check if adaptedTranslations exists instead
    if (!data.adaptedTranslations || typeof data.adaptedTranslations !== 'object') {
      console.warn('[adaptTranslationsToContext] ⚠️ API returned unexpected format, using original translations', {
        response: data,
        hasAdaptedTranslations: !!data.adaptedTranslations
      });
      // Fallback: return original translations
      return translations;
    }

    // API returns adaptedTranslations as {guid: text} object
    const adaptedTranslationsObj = data.adaptedTranslations;

    // Map back to array format
    const adaptedTranslations = translations.map(t => ({
      guid: t.guid,
      text: adaptedTranslationsObj[t.guid] || t.text // Fallback to original if not found
    }));

    console.log('[adaptTranslationsToContext] ✅ AI contextualization complete', {
      originalCount: translations.length,
      adaptedCount: adaptedTranslations.length,
      adaptedGuids: Object.keys(adaptedTranslationsObj).length
    });

    return adaptedTranslations;
  } catch (error) {
    console.error('[adaptTranslationsToContext] ❌ Error adapting translations', error);
    // Fallback: return original translations if AI fails
    return translations;
  }
}

/**
 * Add translation to context
 */
function addTranslationToContext(guid: string, text: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const context = (window as any).__projectTranslationsContext;
  if (!context) {
    console.warn('[cloneAndContextualizeTranslations] ⚠️ No translation context available');
    return;
  }

  if (context.addTranslation) {
    context.addTranslation(guid, text);
  } else if (context.addTranslations) {
    context.addTranslations({ [guid]: text });
  } else {
    console.warn('[cloneAndContextualizeTranslations] ⚠️ No addTranslation method available');
  }
}

/**
 * Clone steps and contextualize translations - New deterministic flow
 *
 * This function:
 * 1. Finds all text parameters of sayMessage tasks in escalations
 * 2. Uses guidMapping to find old GUIDs and gets text from template translations
 * 3. Sends all pairs (new GUID, text) to AI for contextualization
 * 4. Adds all adapted translations to context
 *
 * @param clonedSteps - Cloned steps (already cloned with new GUIDs in parameters)
 * @param guidMapping - Map of old GUID (template) -> new GUID (instance) from cloning
 * @param templateId - Template ID for getting template label
 * @param contextLabel - Context label for AI adaptation (e.g., "data di nascita del paziente")
 * @param locale - Locale code (default: 'it')
 * @returns Map of old GUID -> new GUID for reference
 */
export async function cloneAndContextualizeTranslations(
  clonedSteps: Record<string, Record<string, any>>,
  guidMapping: Map<string, string>,
  templateId: string,
  contextLabel: string,
  locale: string = 'it'
): Promise<Map<string, string>> {
  console.log('[cloneAndContextualizeTranslations] 🚀 Starting new deterministic flow', {
    templateId,
    contextLabel,
    stepsKeys: Object.keys(clonedSteps),
    guidMappingSize: guidMapping.size,
    locale
  });

  const textParams: TextParam[] = [];
  const { getCurrentProjectLocale } = await import('./categoryPresets');
  const projectLocale = getCurrentProjectLocale() || 'it-IT';

  // Create reverse mapping for efficient lookup: newGuid -> oldGuid
  const reverseMapping = new Map<string, string>();
  guidMapping.forEach((newGuid, oldGuid) => {
    reverseMapping.set(newGuid, oldGuid);
  });

  // 1. Find all text parameters of sayMessage tasks in escalations
  const nonSayMessageTasksWithText: Array<{
    nodeTemplateId: string;
    stepType: string;
    escalationIndex: number;
    taskIndex: number;
    taskId: string;
    templateId: string | null | undefined;
    type: number | null | undefined;
    hasTextParam: boolean;
    textParamValue: string | null;
  }> = [];

  Object.entries(clonedSteps).forEach(([nodeTemplateId, nodeSteps]) => {
    Object.entries(nodeSteps).forEach(([stepType, step]: [string, any]) => {
      if (!step.escalations || !Array.isArray(step.escalations)) {
        return;
      }

      step.escalations.forEach((escalation: any, escalationIndex: number) => {
        if (!escalation.tasks || !Array.isArray(escalation.tasks)) {
          return;
        }

        escalation.tasks.forEach((task: any, taskIndex: number) => {
          // Find text parameter (regardless of task type)
          const textParam = task.parameters?.find((p: any) => p.parameterId === 'text');
          const hasTextParam = !!textParam && !!textParam.value;

          // Log non-sayMessage tasks with text parameters
          if (hasTextParam && task.templateId !== 'sayMessage') {
            nonSayMessageTasksWithText.push({
              nodeTemplateId,
              stepType,
              escalationIndex,
              taskIndex,
              taskId: task.id || 'unknown',
              templateId: task.templateId,
              type: task.type,
              hasTextParam: true,
              textParamValue: textParam.value
            });
          }

          // Only process sayMessage tasks
          if (task.templateId !== 'sayMessage') {
            return;
          }

          // Find text parameter (contains new GUID after cloning)
          if (!textParam || !textParam.value) {
            return;
          }

          const newGuid = String(textParam.value);

          // 2. Find old GUID from reverse mapping
          const oldGuid = reverseMapping.get(newGuid);
          if (!oldGuid) {
            console.warn('[cloneAndContextualizeTranslations] ⚠️ No old GUID found in mapping for new GUID', {
              newGuid,
              nodeTemplateId,
              stepType,
              escalationIndex,
              guidMappingSize: guidMapping.size
            });
            return;
          }

          // 3. Get text from template translations using old GUID
          const text = getTranslationFromTemplate(oldGuid, projectLocale);
          if (!text) {
            console.warn('[cloneAndContextualizeTranslations] ⚠️ No translation found for old GUID', {
              oldGuid,
              newGuid,
              nodeTemplateId,
              stepType,
              escalationIndex
            });
            return;
          }

          textParams.push({
            oldGuid,
            newGuid,
            text,
            nodeTemplateId,
            stepType,
            escalationIndex
          });
        });
      });
    });
  });

  // ✅ Log non-sayMessage tasks with text parameters
  if (nonSayMessageTasksWithText.length > 0) {
    console.warn('[cloneAndContextualizeTranslations] ⚠️ Found tasks with text parameters that are NOT sayMessage', {
      count: nonSayMessageTasksWithText.length,
      tasks: nonSayMessageTasksWithText.map(t => ({
        nodeTemplateId: t.nodeTemplateId,
        stepType: t.stepType,
        escalationIndex: t.escalationIndex,
        taskIndex: t.taskIndex,
        taskId: t.taskId,
        templateId: t.templateId,
        type: t.type,
        textParamValue: t.textParamValue
      }))
    });

    // Group by templateId to see patterns
    const groupedByTemplateId = nonSayMessageTasksWithText.reduce((acc, task) => {
      const key = task.templateId || 'null';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(task);
      return acc;
    }, {} as Record<string, typeof nonSayMessageTasksWithText>);

    console.log('[cloneAndContextualizeTranslations] 📊 Non-sayMessage tasks grouped by templateId', {
      groups: Object.entries(groupedByTemplateId).map(([templateId, tasks]) => ({
        templateId,
        count: tasks.length,
        sampleTask: tasks[0]
      }))
    });
  }

  console.log('[cloneAndContextualizeTranslations] 📊 Collected text parameters', {
    totalParams: textParams.length,
    nonSayMessageTasksWithText: nonSayMessageTasksWithText.length,
    sampleParams: textParams.slice(0, 5).map(p => ({
      oldGuid: p.oldGuid.substring(0, 8) + '...',
      newGuid: p.newGuid.substring(0, 8) + '...',
      textPreview: p.text.substring(0, 50) + '...'
    }))
  });

  if (textParams.length === 0) {
    console.warn('[cloneAndContextualizeTranslations] ⚠️ No text parameters found');
    return guidMapping;
  }

  // 4. Get template label for AI context
  const { DialogueTaskService } = await import('../services/DialogueTaskService');
  const template = DialogueTaskService.getTemplate(templateId);
  const templateLabel = template?.label || template?.name || 'Unknown';

  // 5. Send all pairs to AI for contextualization
  const translationsToAdapt = textParams.map(p => ({
    guid: p.newGuid,
    text: p.text
  }));

  const adaptedTranslations = await adaptTranslationsToContext(
    translationsToAdapt,
    contextLabel,
    templateLabel,
    locale
  );

  // 6. Add all adapted translations to context
  adaptedTranslations.forEach(({ guid, text }) => {
    addTranslationToContext(guid, text);
  });

  console.log('[cloneAndContextualizeTranslations] ✅ Flow complete', {
    totalParams: textParams.length,
    adaptedCount: adaptedTranslations.length,
    guidMappingSize: guidMapping.size
  });

  return guidMapping;
}
