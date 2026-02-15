import type { Task } from '../types/taskTypes';
import { extractStartPrompts } from './ddtPromptExtractor';
import { buildTaskTreeNodes } from './taskUtils';
import { DialogueTaskService } from '../services/DialogueTaskService';

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

  // ✅ Carica traduzioni SOLO da memoria (ProjectTranslationsContext)
  // Durante la creazione del wizard, tutto è in memoria - NON cercare nel database
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
    // ✅ Cerca SOLO in memoria (ProjectTranslationsContext)
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      const context = (window as any).__projectTranslationsContext;
      const contextTranslations = context.translations || {};

      console.log('[🔍 AdaptTaskTreePromptToContext] 🔍 Cercando traduzioni in memoria', {
        guidsCount: allGuids.size,
        contextTranslationsCount: Object.keys(contextTranslations).length
      });

      for (const guid of allGuids) {
        const trans = contextTranslations[guid];
        if (trans) {
          const text = typeof trans === 'object'
            ? (trans[projectLocale] || trans.en || trans.it || trans.pt || '')
            : String(trans);
          if (text) {
            projectTranslations[guid] = text;
          }
        }
      }

      console.log('[🔍 AdaptTaskTreePromptToContext] ✅ Traduzioni trovate in memoria', {
        foundInMemory: Object.keys(projectTranslations).length,
        requested: allGuids.size,
        missing: allGuids.size - Object.keys(projectTranslations).length
      });
    } else {
      console.warn('[🔍 AdaptTaskTreePromptToContext] ⚠️ ProjectTranslationsContext non disponibile', {
        hasWindow: typeof window !== 'undefined',
        hasContext: typeof window !== 'undefined' && !!(window as any).__projectTranslationsContext
      });
    }
  }

  console.log('[🔍 AdaptTaskTreePromptToContext] Traduzioni caricate', {
    guidsCount: allGuids.size,
    translationsLoaded: Object.keys(projectTranslations).length,
    missingTranslations: allGuids.size - Object.keys(projectTranslations).length
  });

  // ✅ Verifica: se non ci sono traduzioni per NESSUN GUID, blocca il flusso
  if (allGuids.size > 0 && Object.keys(projectTranslations).length === 0) {
    const errorMsg = 'No template translations found for the prompt GUIDs. Cannot adapt prompts.';
    console.error('[🔍 AdaptTaskTreePromptToContext] ❌ ' + errorMsg, {
      guidsCount: allGuids.size,
      requestedGuids: Array.from(allGuids).slice(0, 5) // Log solo i primi 5
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

  // ✅ Se alcune traduzioni mancano, avvisa ma continua (potrebbero essere sub-nodi non adattati)
  const missingCount = allGuids.size - Object.keys(projectTranslations).length;
  if (missingCount > 0) {
    console.warn('[🔍 AdaptTaskTreePromptToContext] ⚠️ Alcune traduzioni mancanti (potrebbero essere sub-nodi non adattati)', {
      missingCount,
      foundCount: Object.keys(projectTranslations).length,
      totalCount: allGuids.size
    });
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

  // ✅ FASE 3: Prepara payload per API con coppie GUID + TESTO
  // Passa coppie {guid, text} invece di solo testi per corrispondenza esplicita
  const prompts = promptsToAdapt.map(p => ({
    guid: p.guid, // ✅ GUID dell'istanza (già nuovo, generato durante clonazione)
    text: p.text  // ✅ Testo del template copiato nell'istanza
  }));
  const provider = (localStorage.getItem('ai.provider') as 'groq' | 'openai') || 'groq';

  try {
    console.log('[🔍 AdaptTaskTreePromptToContext] Chiamata API adattamento prompt', {
      promptsCount: prompts.length,
      contextLabel,
      normalizedContextLabel,
      templateLabel,
      locale: projectLocale,
      provider,
      prompts: prompts.map(p => ({ guid: p.guid, textPreview: p.text.substring(0, 50) + '...' }))
    });

    const res = await fetch('/api/ddt/adapt-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts, // ✅ Coppie {guid, text} invece di solo testi
        contextLabel: normalizedContextLabel, // ✅ CONTESTO (già passato)
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

    // ✅ FASE 3: L'AI restituisce oggetto {guid: testo} invece di array
    if (!data.adaptedTranslations || typeof data.adaptedTranslations !== 'object') {
      const errorMsg = '[AdaptTaskTreePromptToContext] AI returned unexpected format - expected {guid: text} object';
      console.error(errorMsg, { response: data });
      throw new Error(errorMsg);
    }

    const adaptedTranslations: Record<string, string> = data.adaptedTranslations;

    // ✅ Verifica che tutti i GUID richiesti siano presenti nella risposta
    const requestedGuids = new Set(prompts.map(p => p.guid));
    const returnedGuids = new Set(Object.keys(adaptedTranslations));
    const missingGuids = Array.from(requestedGuids).filter(guid => !returnedGuids.has(guid));

    if (missingGuids.length > 0) {
      console.warn('[🔍 AdaptTaskTreePromptToContext] ⚠️ AI non ha restituito testi per alcuni GUID', {
        missingGuids,
        requestedCount: requestedGuids.size,
        returnedCount: returnedGuids.size
      });
    }

    console.log('[🔍 AdaptTaskTreePromptToContext] Prompt adattati ricevuti', {
      adaptedCount: Object.keys(adaptedTranslations).length,
      requestedCount: prompts.length,
      sampleTranslations: Object.entries(adaptedTranslations).slice(0, 3).map(([guid, text]) => ({
        guid,
        textPreview: text.substring(0, 50) + '...'
      }))
    });

    // ✅ FASE 3: Sovrascrivi solo le traduzioni (NON serve più mapping old→new o sostituzione GUID)
    // I GUID sono già definitivi (generati durante clonazione)
    // I task hanno già i GUID corretti
    // Devi solo sovrascrivere le traduzioni con i testi adattati
    if (typeof window !== 'undefined' && (window as any).__projectTranslationsContext) {
      (window as any).__projectTranslationsContext.addTranslations(adaptedTranslations);
      console.log('[🔍 AdaptTaskTreePromptToContext] ✅ Traduzioni sovrascritte nel context (in memoria)', {
        count: Object.keys(adaptedTranslations).length,
        guids: Object.keys(adaptedTranslations),
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
      promptsAdapted: Object.keys(adaptedTranslations).length,
      taskStepsUpdated: false // ✅ NON serve più aggiornare task.steps - i GUID sono già corretti
    });

  } catch (err) {
    const errorMsg = `[AdaptTaskTreePromptToContext] ❌ Errore durante adattamento prompt: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg, err);
    throw new Error(errorMsg);
  }
}
