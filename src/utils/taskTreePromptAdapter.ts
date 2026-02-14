import type { Task } from '../types/taskTypes';
import { extractStartPrompts } from './ddtPromptExtractor';
import { buildTaskTreeNodes } from './taskUtils';
import { DialogueTaskService } from '../services/DialogueTaskService';
import { v4 as uuidv4 } from 'uuid';

/**
 * ============================================================================
 * TaskTree Prompt Adapter - Adattamento Prompt al Contesto
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
export async function AdaptTaskTreePromptToContext(
  task: Task,
  contextLabel: string,
  adaptAllNormalSteps: boolean = false
): Promise<void> {
  console.log('[🔍 AdaptTaskTreePromptToContext] START', {
    taskId: task.id,
    taskLabel: task.label,
    contextLabel,
    adaptAllNormalSteps,
    hasTaskSteps: !!task.steps,
    taskStepsKeys: task.steps ? Object.keys(task.steps) : []
  });

  // ✅ Validazione input
  if (!task) {
    const errorMsg = '[AdaptTaskTreePromptToContext] task è obbligatorio';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!task.templateId) {
    const errorMsg = `[AdaptTaskTreePromptToContext] Task senza templateId: ${task.id}`;
    console.error(errorMsg, { taskId: task.id });
    throw new Error(errorMsg);
  }

  if (!task.steps || Object.keys(task.steps).length === 0) {
    console.warn('[🔍 AdaptTaskTreePromptToContext] ⚠️ Task senza steps, niente da adattare', {
      taskId: task.id
    });
    return;
  }

  // ✅ Carica template per ottenere label template
  const template = DialogueTaskService.getTemplate(task.templateId);
  if (!template) {
    const errorMsg = `[AdaptTaskTreePromptToContext] Template non trovato: ${task.templateId}`;
    console.error(errorMsg, { taskId: task.id, templateId: task.templateId });
    throw new Error(errorMsg);
  }

  const templateLabel = template.label || template.name || 'Unknown';
  console.log('[🔍 AdaptTaskTreePromptToContext] Template caricato', {
    templateId: template.id || template._id,
    templateLabel
  });

  // ✅ Costruisci albero dati per estrazione prompt
  const nodes = buildTaskTreeNodes(template);
  console.log('[🔍 AdaptTaskTreePromptToContext] Nodes costruito', {
    nodesLength: nodes.length
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
      const errorMsg = 'Could not adapt prompts because template translations were not reachable.';
      console.error('[🔍 AdaptTaskTreePromptToContext] ❌ ' + errorMsg, {
        error: err instanceof Error ? err.message : String(err),
        guidsCount: allGuids.size
      });

      if (typeof window !== 'undefined') {
        const retry = () => AdaptTaskTreePromptToContext(task, contextLabel, adaptAllNormalSteps);
        const event = new CustomEvent('service:unavailable', {
          detail: {
            service: 'Template translations',
            message: errorMsg,
            endpoint: '/api/factory/template-translations',
            onRetry: retry
          },
          bubbles: true
        });
        window.dispatchEvent(event);
      }
      return;
    }
  }

  console.log('[🔍 AdaptTaskTreePromptToContext] Traduzioni caricate', {
    guidsCount: allGuids.size,
    translationsLoaded: Object.keys(projectTranslations).length
  });

  if (allGuids.size > 0 && Object.keys(projectTranslations).length === 0) {
    const errorMsg = 'No template translations found for the prompt GUIDs. Cannot adapt prompts.';
    console.error('[🔍 AdaptTaskTreePromptToContext] ❌ ' + errorMsg, {
      guidsCount: allGuids.size
    });
    if (typeof window !== 'undefined') {
      const retry = () => AdaptPromptToContext(task, contextLabel, adaptAllNormalSteps);
      const event = new CustomEvent('service:unavailable', {
        detail: {
          service: 'Template translations',
          message: errorMsg,
          endpoint: '/api/factory/template-translations',
          onRetry: retry
        },
        bubbles: true
      });
      window.dispatchEvent(event);
    }
    return;
  }

  // ✅ Estrai prompt da adattare
  const promptsToAdapt = extractStartPrompts(
    task.steps,
    nodes,
    projectTranslations,
    { onlyRootNodes: !adaptAllNormalSteps }
  );

  if (promptsToAdapt.length === 0) {
    console.log('[🔍 AdaptTaskTreePromptToContext] Nessun prompt da adattare', {
      taskId: task.id
    });
    return;
  }

  console.log('[🔍 AdaptTaskTreePromptToContext] Prompt estratti', {
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
    console.log('[🔍 AdaptTaskTreePromptToContext] Chiamata API adattamento prompt', {
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
      const errorMsg = `[AdaptTaskTreePromptToContext] API returned ${res.status}: ${res.statusText}`;
      console.error(errorMsg, {
        status: res.status,
        statusText: res.statusText,
        url: '/api/ddt/adapt-prompts',
        backendUrl: 'http://localhost:8000'
      });

      // ✅ Se 404, mostra messaggio di servizio e continua senza adattamento
      if (res.status === 404) {
        const errorMsg = 'Prompt adaptation service not reachable. Original template prompts will be used.';
        console.error('[🔍 AdaptTaskTreePromptToContext] ❌ ' + errorMsg, {
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
          const retry = () => AdaptTaskTreePromptToContext(task, contextLabel, adaptAllNormalSteps);
          const event = new CustomEvent('service:unavailable', {
            detail: {
              service: 'Prompt adaptation',
              message: errorMsg,
              endpoint: '/api/ddt/adapt-prompts',
              severity: 'warning',
              onRetry: retry
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
      const errorMsg = '[AdaptTaskTreePromptToContext] AI returned unexpected format';
      console.error(errorMsg, { response: data });
      throw new Error(errorMsg);
    }

    console.log('[🔍 AdaptTaskTreePromptToContext] Prompt adattati ricevuti', {
      adaptedCount: data.adaptedTexts.length
    });

    // ✅ STEP 1: Genera nuovi GUID per ogni prompt adattato
    // Mappa: oldGuid (template) -> newGuid (instance)
    const guidMapping = new Map<string, string>();
    // Mappa: newGuid -> testo adattato (per salvare traduzioni)
    const adaptedTranslations: Record<string, string> = {};

    promptsToAdapt.forEach((p, idx) => {
      const oldGuid = p.guid; // GUID del template
      const newGuid = uuidv4(); // Nuovo GUID per l'istanza
      guidMapping.set(oldGuid, newGuid);
      adaptedTranslations[newGuid] = data.adaptedTexts[idx]; // Testo adattato con nuovo GUID
    });

    console.log('[🔍 AdaptTaskTreePromptToContext] GUID mapping creato', {
      promptsCount: promptsToAdapt.length,
      guidMappings: Array.from(guidMapping.entries()).map(([old, newGuid]) => ({
        oldGuid: old,
        newGuid: newGuid
      }))
    });

    // ✅ STEP 2: Aggiorna task.steps in-place sostituendo i vecchi GUID con i nuovi GUID
    Object.values(task.steps).forEach((nodeSteps: any) => {
      const startStep = nodeSteps?.start || nodeSteps?.normal;
      if (startStep?.escalations?.[0]?.tasks) {
        startStep.escalations[0].tasks.forEach((t: any) => {
          const textParam = t.parameters?.find((p: any) => p.parameterId === 'text');
          const oldGuid = textParam?.value || t.taskId || t.id;

          // ✅ Se questo GUID ha un mapping (è un prompt adattato), sostituisci con nuovo GUID
          if (oldGuid && guidMapping.has(oldGuid)) {
            const newGuid = guidMapping.get(oldGuid)!;

            // ✅ Sostituisci il vecchio GUID con il nuovo GUID nel parametro
            if (textParam) {
              textParam.value = newGuid; // ✅ NUOVO GUID, non il testo!
            } else {
              // Se non esiste il parametro, crealo
              if (!t.parameters) {
                t.parameters = [];
              }
              t.parameters.push({
                parameterId: 'text',
                value: newGuid // ✅ NUOVO GUID, non il testo!
              });
            }
          }
        });
      }
    });

    console.log('[🔍 AdaptTaskTreePromptToContext] ✅ task.steps aggiornato in-place con nuovi GUID', {
      taskId: task.id,
      promptsUpdated: guidMapping.size,
      oldGuids: Array.from(guidMapping.keys()),
      newGuids: Array.from(guidMapping.values())
    });

    // ✅ STEP 3: Salva traduzioni adattate con i nuovi GUID
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      (window as any).__projectTranslationsContext.addTranslations(adaptedTranslations);
      console.log('[🔍 AdaptTaskTreePromptToContext] ✅ Traduzioni aggiunte al context (in memoria)', {
        count: Object.keys(adaptedTranslations).length,
        newGuids: Object.keys(adaptedTranslations),
        sampleTexts: Object.entries(adaptedTranslations).slice(0, 3).map(([guid, text]) => ({
          guid,
          textPreview: text.substring(0, 50) + '...'
        }))
      });
    } else {
      console.warn('[🔍 AdaptTaskTreePromptToContext] ⚠️ ProjectTranslationsContext non disponibile', {
        hasWindow: typeof window !== 'undefined',
        hasContext: typeof window !== 'undefined' && !!(window as any).__projectTranslationsContext
      });
    }

    // ✅ 3. Aggiorna metadata task in memoria (NO salvataggio DB)
    task.metadata = { ...task.metadata, promptsAdapted: true };

    console.log('[🔍 AdaptTaskTreePromptToContext] COMPLETE', {
      taskId: task.id,
      promptsAdapted: data.adaptedTexts.length,
      taskStepsUpdated: true
    });

  } catch (err) {
    const errorMsg = `[AdaptTaskTreePromptToContext] ❌ Errore durante adattamento prompt: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg, err);
    throw new Error(errorMsg);
  }
}
