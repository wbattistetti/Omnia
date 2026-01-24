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
  const { getTemplateTranslations } = await import('../services/ProjectDataService');
  const { getCurrentProjectLocale } = await import('./categoryPresets');

  // Raccogli tutti i GUID dai task negli steps
  const allGuids = new Set<string>();
  Object.values(task.steps).forEach((nodeSteps: any) => {
    const startStep = nodeSteps?.start || nodeSteps?.normal;
    if (startStep?.escalations?.[0]?.tasks) {
      startStep.escalations[0].tasks.forEach((t: any) => {
        const textGuid = t.parameters?.find((p: any) => p.parameterId === 'text')?.value || t.taskId || t.id;
        if (textGuid) allGuids.add(textGuid);
      });
    }
  });

  const projectLocale = getCurrentProjectLocale() || 'it';
  const projectTranslations: Record<string, string> = {};

  if (allGuids.size > 0) {
    try {
      const translations = await getTemplateTranslations(Array.from(allGuids));
      for (const guid of allGuids) {
        const trans = translations[guid];
        if (trans) {
          const text = typeof trans === 'object'
            ? (trans[projectLocale] || trans.en || trans.it || trans.pt || '')
            : String(trans);
          if (text) projectTranslations[guid] = text;
        }
      }
    } catch (err) {
      console.warn('[🔍 AdaptPromptToContext] ⚠️ Failed to load translations, continuing without them', {
        error: err instanceof Error ? err.message : String(err),
        guidsCount: allGuids.size
      });
      // Continue without translations - prompts will use original text from template
    }
  }

  console.log('[🔍 AdaptPromptToContext] Traduzioni caricate', {
    guidsCount: allGuids.size,
    translationsLoaded: Object.keys(projectTranslations).length
  });

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

  // ✅ Normalizza contextLabel: estrai solo la parte descrittiva
  // Es: "Chiedi la data di nascita del paziente" -> "data di nascita del paziente"
  const normalizeContextLabel = (label: string): string => {
    let normalized = label.toLowerCase().trim();
    // Rimuovi verbi all'imperativo all'inizio
    const verbsToRemove = ['chiedi', 'richiedi', 'domanda', 'acquisisci', 'raccogli', 'invita', 'ask', 'request', 'collect', 'tell', 'give'];
    for (const verb of verbsToRemove) {
      if (normalized.startsWith(verb + ' ')) {
        normalized = normalized.substring(verb.length + 1).trim();
        break;
      }
    }
    // Rimuovi articoli all'inizio se presenti
    const articles = ['la', 'il', 'lo', 'le', 'gli', 'the', 'a', 'an'];
    for (const article of articles) {
      if (normalized.startsWith(article + ' ')) {
        normalized = normalized.substring(article.length + 1).trim();
        break;
      }
    }
    return normalized;
  };

  const normalizedContextLabel = normalizeContextLabel(contextLabel);

  // ✅ Prepara payload per API
  const originalTexts = promptsToAdapt.map(p => p.text);
  const provider = (localStorage.getItem('ai.provider') as 'groq' | 'openai') || 'groq';

  try {
    console.log('[🔍 AdaptPromptToContext] Chiamata API adattamento prompt', {
      promptsCount: originalTexts.length,
      contextLabel,
      normalizedContextLabel,
      templateLabel,
      locale: projectLocale,
      provider
    });

    const res = await fetch('/api/ddt/adapt-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalTexts,
        contextLabel: normalizedContextLabel, // ✅ Usa la versione normalizzata
        templateLabel,
        locale: projectLocale,
        provider
      })
    });

    if (!res.ok) {
      const errorMsg = `[AdaptPromptToContext] API returned ${res.status}: ${res.statusText}`;
      console.error(errorMsg, {
        status: res.status,
        statusText: res.statusText,
        url: '/api/ddt/adapt-prompts',
        backendUrl: 'http://localhost:8000'
      });

      // ✅ Se 404, mostra messaggio di servizio e continua senza adattamento
      if (res.status === 404) {
        const errorMsg = 'Servizio di personalizzazione prompt non raggiungibile. Verranno usati i prompt originali dal template.';
        console.error('[🔍 AdaptPromptToContext] ❌ ' + errorMsg, {
          endpoint: '/api/ddt/adapt-prompts',
          backendUrl: 'http://localhost:8000',
          possibleCauses: [
            'Backend FastAPI non in esecuzione su porta 8000',
            'Router adapt_prompts_router non incluso correttamente',
            'Backend non riavviato dopo aggiunta endpoint'
          ]
        });

        // ✅ Mostra messaggio di servizio all'utente
        if (typeof window !== 'undefined') {
          const event = new CustomEvent('service:unavailable', {
            detail: {
              service: 'Personalizzazione Prompt',
              message: errorMsg,
              endpoint: '/api/ddt/adapt-prompts',
              severity: 'warning'
            },
            bubbles: true
          });
          window.dispatchEvent(event);
        }

        // Non bloccare il flusso, usa i prompt originali
        return;
      }

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

    // ✅ Crea mappa GUID -> testo adattato
    const adaptedTranslations: Record<string, string> = {};
    promptsToAdapt.forEach((p, idx) => {
      adaptedTranslations[p.guid] = data.adaptedTexts[idx];
    });

    console.log('[🔍 AdaptPromptToContext] Riassociazione prompt', {
      adaptedCount: Object.keys(adaptedTranslations).length,
      guids: Object.keys(adaptedTranslations)
    });

    // ✅ 1. Aggiorna task.steps in-place con i nuovi prompt adattati
    Object.values(task.steps).forEach((nodeSteps: any) => {
      const startStep = nodeSteps?.start || nodeSteps?.normal;
      if (startStep?.escalations?.[0]?.tasks) {
        startStep.escalations[0].tasks.forEach((t: any) => {
          const textParam = t.parameters?.find((p: any) => p.parameterId === 'text');
          const textGuid = textParam?.value || t.taskId || t.id;

          // ✅ Se questo GUID ha un prompt adattato, aggiorna il parametro text
          if (textGuid && adaptedTranslations[textGuid]) {
            // ✅ Aggiorna il valore del parametro text direttamente in task.steps
            if (textParam) {
              textParam.value = adaptedTranslations[textGuid];
            } else {
              // Se non esiste il parametro, crealo
              if (!t.parameters) {
                t.parameters = [];
              }
              t.parameters.push({
                parameterId: 'text',
                value: adaptedTranslations[textGuid]
              });
            }
          }
        });
      }
    });

    console.log('[🔍 AdaptPromptToContext] ✅ task.steps aggiornato in-place', {
      taskId: task.id,
      promptsUpdated: Object.keys(adaptedTranslations).length
    });

    // ✅ 2. Aggiungi traduzioni al ProjectTranslationsContext in memoria (NO salvataggio DB)
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      (window as any).__projectTranslationsContext.addTranslations(adaptedTranslations);
      console.log('[🔍 AdaptPromptToContext] ✅ Traduzioni aggiunte al context (in memoria)', {
        count: Object.keys(adaptedTranslations).length,
        guids: Object.keys(adaptedTranslations),
        sampleTexts: Object.entries(adaptedTranslations).slice(0, 3).map(([guid, text]) => ({
          guid,
          textPreview: text.substring(0, 50) + '...'
        }))
      });
    } else {
      console.warn('[🔍 AdaptPromptToContext] ⚠️ ProjectTranslationsContext non disponibile', {
        hasWindow: typeof window !== 'undefined',
        hasContext: typeof window !== 'undefined' && !!(window as any).__projectTranslationsContext
      });
    }

    // ✅ 3. Aggiorna metadata task in memoria (NO salvataggio DB)
    task.metadata = { ...task.metadata, promptsAdapted: true };

    console.log('[🔍 AdaptPromptToContext] COMPLETE', {
      taskId: task.id,
      promptsAdapted: data.adaptedTexts.length,
      taskStepsUpdated: true
    });

  } catch (err) {
    const errorMsg = `[AdaptPromptToContext] ❌ Errore durante adattamento prompt: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg, err);
    throw new Error(errorMsg);
  }
}
