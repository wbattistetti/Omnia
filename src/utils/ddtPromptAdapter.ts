import type { Task } from '../types/taskTypes';
import { extractStartPrompts } from './ddtPromptExtractor';
import { buildDataTree } from './taskUtils';
import { DialogueTaskService } from '../services/DialogueTaskService';

/**
 * ============================================================================
 * DDT Prompt Adapter - Adattamento Prompt al Contesto
 * ============================================================================
 *
 * Adatta i prompt al contesto usando AI.
 *
 * REGOLE:
 * - Estrae prompt solo da escalation 1, step "start", task SayMessage
 * - Flag adaptAllNormalSteps: false = solo nodi radice, true = tutti i nodi
 * - Invia batch all'AI (una chiamata per tutti i prompt)
 * - Modifica task.steps in-place (non ritorna nulla)
 * - Usa SEMPRE templateId (nessun fallback)
 */

/**
 * Adatta i prompt al contesto usando AI.
 * Modifica task.steps in-place aggiornando i prompt adattati.
 *
 * @param task - Task con steps già clonati
 * @param contextLabel - Label del contesto (es. "data di nascita del paziente")
 * @param adaptAllNormalSteps - Se false, adatta solo nodi radice; se true, adatta tutti i nodi
 * @throws Error se task non ha templateId o se l'API fallisce
 */
export async function AdaptPromptToContext(
  task: Task,
  contextLabel: string,
  adaptAllNormalSteps: boolean = false
): Promise<void> {
  console.log('[🔍 AdaptPromptToContext] START', {
    taskId: task.id,
    taskLabel: task.label,
    contextLabel,
    adaptAllNormalSteps,
    hasTaskSteps: !!task.steps,
    taskStepsKeys: task.steps ? Object.keys(task.steps) : []
  });

  // ✅ Validazione input
  if (!task) {
    const errorMsg = '[AdaptPromptToContext] task è obbligatorio';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!task.templateId) {
    const errorMsg = `[AdaptPromptToContext] Task senza templateId: ${task.id}`;
    console.error(errorMsg, { taskId: task.id });
    throw new Error(errorMsg);
  }

  if (!task.steps || Object.keys(task.steps).length === 0) {
    console.warn('[🔍 AdaptPromptToContext] ⚠️ Task senza steps, niente da adattare', {
      taskId: task.id
    });
    return;
  }

  // ✅ Carica template per ottenere label template
  const template = DialogueTaskService.getTemplate(task.templateId);
  if (!template) {
    const errorMsg = `[AdaptPromptToContext] Template non trovato: ${task.templateId}`;
    console.error(errorMsg, { taskId: task.id, templateId: task.templateId });
    throw new Error(errorMsg);
  }

  const templateLabel = template.label || template.name || 'Unknown';
  console.log('[🔍 AdaptPromptToContext] Template caricato', {
    templateId: template.id || template._id,
    templateLabel
  });

  // ✅ Costruisci albero dati per estrazione prompt
  const dataTree = buildDataTree(template);
  console.log('[🔍 AdaptPromptToContext] DataTree costruito', {
    dataTreeLength: dataTree.length
  });

  // ✅ Carica traduzioni del progetto (necessarie per estrarre i testi)
  // TODO: Caricare da ProjectTranslationsContext o da dove sono memorizzate
  const projectTranslations: Record<string, string> = {};
  // Per ora, assumiamo che le traduzioni siano già caricate nel contesto
  // Questo sarà implementato quando integreremo con il sistema di traduzioni

  // ✅ Estrai prompt da adattare
  const promptsToAdapt = extractStartPrompts(
    task.steps,
    dataTree,
    projectTranslations,
    { onlyRootNodes: !adaptAllNormalSteps }
  );

  if (promptsToAdapt.length === 0) {
    console.log('[🔍 AdaptPromptToContext] Nessun prompt da adattare', {
      taskId: task.id
    });
    return;
  }

  console.log('[🔍 AdaptPromptToContext] Prompt estratti', {
    promptsCount: promptsToAdapt.length,
    prompts: promptsToAdapt.map(p => ({
      nodeTemplateId: p.nodeTemplateId,
      guid: p.guid,
      textPreview: p.text.substring(0, 50) + '...'
    }))
  });

  // ✅ Prepara payload per API
  const originalTexts = promptsToAdapt.map(p => p.text);
  const projectLocale = 'it'; // TODO: Ottenere da contesto progetto
  const provider: 'groq' | 'openai' = 'groq'; // TODO: Ottenere da configurazione

  try {
    console.log('[🔍 AdaptPromptToContext] Chiamata API adattamento prompt', {
      promptsCount: originalTexts.length,
      contextLabel,
      templateLabel,
      locale: projectLocale,
      provider
    });

    const res = await fetch('/api/ddt/adapt-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalTexts,
        contextLabel,
        templateLabel,
        locale: projectLocale,
        provider
      })
    });

    if (!res.ok) {
      const errorMsg = `[AdaptPromptToContext] API returned ${res.status}: ${res.statusText}`;
      console.error(errorMsg, { status: res.status, statusText: res.statusText });
      throw new Error(errorMsg);
    }

    const data = await res.json();

    if (!data.adaptedTexts || !Array.isArray(data.adaptedTexts) || data.adaptedTexts.length !== promptsToAdapt.length) {
      const errorMsg = '[AdaptPromptToContext] AI returned unexpected format';
      console.error(errorMsg, { response: data });
      throw new Error(errorMsg);
    }

    console.log('[🔍 AdaptPromptToContext] Prompt adattati ricevuti', {
      adaptedCount: data.adaptedTexts.length
    });

    // ✅ Riassocia prompt adattati agli steps (modifica in-place)
    // TODO: Implementare riassociazione usando taskKey o guid
    // Per ora, assumiamo che l'ordine sia mantenuto
    // Questo sarà implementato quando avremo il sistema di traduzioni completo

    console.warn('[🔍 AdaptPromptToContext] ⚠️ Riassociazione prompt non ancora implementata completamente');
    console.log('[🔍 AdaptPromptToContext] Prompt adattati (da riassociare)', {
      adaptedTexts: data.adaptedTexts.map((text: string, idx: number) => ({
        original: promptsToAdapt[idx].text.substring(0, 50) + '...',
        adapted: text.substring(0, 50) + '...',
        guid: promptsToAdapt[idx].guid,
        nodeTemplateId: promptsToAdapt[idx].nodeTemplateId
      }))
    });

    // TODO: Aggiornare task.steps con i prompt adattati
    // Questo richiede:
    // 1. Trovare il task corrispondente negli steps usando guid o taskKey
    // 2. Aggiornare la traduzione corrispondente
    // 3. Salvare le nuove traduzioni nel sistema di traduzioni

    console.log('[🔍 AdaptPromptToContext] COMPLETE', {
      taskId: task.id,
      promptsAdapted: data.adaptedTexts.length
    });

  } catch (err) {
    const errorMsg = `[AdaptPromptToContext] ❌ Errore durante adattamento prompt: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg, err);
    throw new Error(errorMsg);
  }
}
