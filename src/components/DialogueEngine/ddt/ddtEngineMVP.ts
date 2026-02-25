// DDT Engine MVP - PASSO 1: Motore minimo semplificato
// Obiettivo: Mostrare primo prompt, attendere input completo, salvare, mostrare Success, fine

import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { DDTNavigatorCallbacks, RetrieveResult } from './ddtTypes';

/**
 * Motore MVP semplificato per PASSO 1
 *
 * Comportamento:
 * 1. Trova primo nodo main
 * 2. Mostra step Start (primo escalation)
 * 3. Attende input utente
 * 4. Interpreta input (semplificato: sempre Match se non vuoto)
 * 5. Salva in memory
 * 6. Mostra Success
 * 7. Fine
 *
 * Limitazioni PASSO 1:
 * - No escalation (se NoMatch, fine/errore)
 * - No sub-task (non chiede dati mancanti)
 * - No confirmation (va direttamente a Success)
 * - No validation (non valida input)
 */
export async function runDDTMVP(
  ddtInstance: AssembledTaskTree,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  console.log('[DDTEngineMVP] 🚀 Starting MVP engine (PASSO 1)', {
    ddtId: ddtInstance.id,
    ddtLabel: ddtInstance.label,
    nodesCount: ddtInstance.nodes?.length || 0,
    timestamp: new Date().toISOString()
  });

  try {
    // 1. Trova il primo nodo main
    const firstNode = ddtInstance.nodes?.[0];
    if (!firstNode) {
      console.error('[DDTEngineMVP] ❌ No nodes found');
      return { success: false, error: new Error('No nodes found in DDT instance') };
    }

    console.log('[DDTEngineMVP] 📋 First node:', {
      id: firstNode.id,
      label: firstNode.label,
      templateId: firstNode.templateId,
      hasSteps: !!firstNode.steps,
      stepsKeys: firstNode.steps ? Object.keys(firstNode.steps) : []
    });

    // 2. Trova step Start del primo nodo
    const startStep = firstNode.steps?.start;
    if (!startStep) {
      console.error('[DDTEngineMVP] ❌ No start step found in first node');
      return { success: false, error: new Error('No start step found in first node') };
    }

    if (!startStep.escalations || startStep.escalations.length === 0) {
      console.error('[DDTEngineMVP] ❌ No escalations in start step');
      return { success: false, error: new Error('No escalations in start step') };
    }

    // 3. Prendi prima escalation (livello 0)
    const firstEscalation = startStep.escalations[0];
    if (!firstEscalation.tasks || firstEscalation.tasks.length === 0) {
      console.error('[DDTEngineMVP] ❌ No tasks in first escalation');
      return { success: false, error: new Error('No tasks in first escalation') };
    }

    console.log('[DDTEngineMVP] 📋 First escalation:', {
      tasksCount: firstEscalation.tasks.length,
      tasks: firstEscalation.tasks.map((t: any) => ({
        id: t.id,
        templateId: t.templateId,
        type: t.type
      }))
    });

    // 4. Trova task SayMessage nella prima escalation
    const sayMessageTask = firstEscalation.tasks.find((t: any) =>
      t.templateId === 'sayMessage' || t.type === 'SayMessage' || t.templateId === 'SayMessage'
    );

    if (!sayMessageTask) {
      console.error('[DDTEngineMVP] ❌ No SayMessage task found in first escalation');
      return { success: false, error: new Error('No SayMessage task found in start step') };
    }

    // 5. Risolvi testo usando traduzioni
    const translations = callbacks.translations || {};
    const textParam = sayMessageTask.parameters?.find((p: any) =>
      p.parameterId === 'text' || p.key === 'text' || p.parameterId === 'message'
    );

    if (!textParam || !textParam.value) {
      console.error('[DDTEngineMVP] ❌ No text parameter found in SayMessage task', {
        taskId: sayMessageTask.id,
        parameters: sayMessageTask.parameters
      });
      return { success: false, error: new Error('No text parameter found in SayMessage task') };
    }

    const textKey = textParam.value;
    const translatedText = translations[textKey] || textKey; // Fallback a key se traduzione mancante

    console.log('[DDTEngineMVP] 📨 Resolving text:', {
      textKey,
      hasTranslation: !!translations[textKey],
      translatedText: translatedText.substring(0, 100) + (translatedText.length > 100 ? '...' : ''),
      translationsCount: Object.keys(translations).length,
      sampleTranslationKeys: Object.keys(translations).slice(0, 5)
    });

    if (!translatedText || translatedText.trim().length === 0) {
      console.error('[DDTEngineMVP] ❌ Translated text is empty', { textKey });
      return { success: false, error: new Error('Translated text is empty') };
    }

    // 6. Mostra messaggio iniziale
    if (callbacks.onMessage) {
      callbacks.onMessage(translatedText, 'start', 0);
      console.log('[DDTEngineMVP] ✅ Start message sent:', translatedText.substring(0, 50) + '...');
    } else {
      console.error('[DDTEngineMVP] ❌ onMessage callback not provided');
      return { success: false, error: new Error('onMessage callback not provided') };
    }

    // 7. Attendi input utente
    if (!callbacks.onGetRetrieveEvent) {
      console.error('[DDTEngineMVP] ❌ onGetRetrieveEvent callback not provided');
      return { success: false, error: new Error('onGetRetrieveEvent callback not provided') };
    }

    console.log('[DDTEngineMVP] ⏸️ Waiting for user input...');
    const retrieveEvent = await callbacks.onGetRetrieveEvent(firstNode.id);

    console.log('[DDTEngineMVP] 📥 User input received:', {
      eventType: retrieveEvent.type,
      hasValue: 'value' in retrieveEvent
    });

    // 8. Processa input (semplificato: sempre Match se non vuoto)
    if (retrieveEvent.type === 'noInput') {
      console.warn('[DDTEngineMVP] ⚠️ No input received (PASSO 1: no escalation, ending)');
      return { success: false, error: new Error('No input received') };
    }

    if (retrieveEvent.type === 'noMatch') {
      console.warn('[DDTEngineMVP] ⚠️ No match (PASSO 1: no escalation, ending)');
      return { success: false, error: new Error('No match') };
    }

    if (retrieveEvent.type !== 'match' || !retrieveEvent.value) {
      console.error('[DDTEngineMVP] ❌ Invalid retrieve event:', retrieveEvent);
      return { success: false, error: new Error('Invalid retrieve event') };
    }

    const inputValue = retrieveEvent.value;
    console.log('[DDTEngineMVP] ✅ Input processed as Match:', {
      value: typeof inputValue === 'string' ? inputValue.substring(0, 50) + '...' : inputValue
    });

    // 9. Salva in memory (semplificato)
    const memory: Record<string, { value: any; confirmed: boolean }> = {};
    memory[firstNode.id] = { value: inputValue, confirmed: false };

    console.log('[DDTEngineMVP] 💾 Memory saved:', {
      nodeId: firstNode.id,
      value: typeof inputValue === 'string' ? inputValue.substring(0, 50) + '...' : inputValue
    });

    // 10. Mostra Success (se esiste)
    const successStep = firstNode.steps?.success;
    if (successStep && successStep.escalations && successStep.escalations.length > 0) {
      const successEscalation = successStep.escalations[0];
      if (successEscalation.tasks && successEscalation.tasks.length > 0) {
        const successTask = successEscalation.tasks.find((t: any) =>
          t.templateId === 'sayMessage' || t.type === 'SayMessage' || t.templateId === 'SayMessage'
        );

        if (successTask) {
          const successTextParam = successTask.parameters?.find((p: any) =>
            p.parameterId === 'text' || p.key === 'text' || p.parameterId === 'message'
          );

          if (successTextParam && successTextParam.value) {
            const successTextKey = successTextParam.value;
            const successTranslatedText = translations[successTextKey] || successTextKey;

            console.log('[DDTEngineMVP] 📨 Resolving success text:', {
              textKey: successTextKey,
              hasTranslation: !!translations[successTextKey],
              translatedText: successTranslatedText.substring(0, 50) + '...'
            });

            if (successTranslatedText && successTranslatedText.trim().length > 0 && callbacks.onMessage) {
              callbacks.onMessage(successTranslatedText, 'success', 0);
              console.log('[DDTEngineMVP] ✅ Success message sent');
            }
          }
        }
      }
    } else {
      console.log('[DDTEngineMVP] ℹ️ No success step found, skipping success message');
    }

    // 11. Fine
    console.log('[DDTEngineMVP] ✅ MVP engine completed successfully');
    return { success: true, value: memory };

  } catch (error) {
    console.error('[DDTEngineMVP] ❌ Error in MVP engine:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
