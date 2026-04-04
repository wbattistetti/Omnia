// DDT Engine MVP - FASE 2: Escalation Base
// Obiettivo: Gestire escalation per NoMatch e NoInput, rimanere nello stesso step finché non c'è Match

import type { AssembledTaskTree } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { DDTNavigatorCallbacks, RetrieveResult } from './ddtTypes';
import { translationKeyFromStoredValue } from '../../../utils/translationKeys';

/**
 * Motore MVP FASE 2 - Escalation Base
 *
 * Comportamento:
 * 1. Trova primo nodo main
 * 2. Mostra step Start (primo escalation)
 * 3. Loop principale:
 *    - Attende input utente
 *    - Se Match: salva, mostra Success, fine
 *    - Se NoMatch: incrementa counter, mostra escalation NoMatch, rimani nello stesso step
 *    - Se NoInput: incrementa counter, mostra escalation NoInput, rimani nello stesso step
 * 4. L'ultima escalation si ripete all'infinito se counter > numero di escalation
 *
 * Caratteristiche FASE 2:
 * - ✅ Gestione escalation NoMatch e NoInput
 * - ✅ Contatori per nodo (noMatchCounters, noInputCounters)
 * - ✅ Selezione escalation corretta (ripete l'ultima se necessario)
 * - ✅ Rimane nello stesso step finché non c'è Match
 * - ❌ No sub-task (non chiede dati mancanti)
 * - ❌ No confirmation (va direttamente a Success)
 * - ❌ No validation (non valida input)
 */

interface DDTEngineState {
  currentNodeId: string;
  currentStepType: 'start' | 'noMatch' | 'noInput' | 'success';
  noMatchCounters: Record<string, number>;
  noInputCounters: Record<string, number>;
  memory: Record<string, { value: any; confirmed: boolean }>;
}
/**
 * Seleziona escalation basandosi sul counter
 * Se counter >= numero di escalation, usa l'ultima (ripetizione infinita)
 */
function selectEscalation(step: any, counter: number): any {
  if (!step?.escalations || step.escalations.length === 0) {
    return null;
  }

  // Se counter >= numero di escalation, usa l'ultima (ripetizione infinita)
  const escalationIndex = Math.min(counter, step.escalations.length - 1);
  return step.escalations[escalationIndex];
}

/**
 * Esegue un'escalation (mostra messaggio)
 */
async function executeEscalation(
  escalation: any,
  translations: Record<string, string>,
  callbacks: DDTNavigatorCallbacks,
  stepType: string,
  escalationNumber: number
): Promise<void> {
  if (!escalation?.tasks || escalation.tasks.length === 0) {
    console.warn('[DDTEngineMVP] ⚠️ Escalation has no tasks', { stepType, escalationNumber });
    return;
  }

  // Trova task SayMessage
  const sayMessageTask = escalation.tasks.find((t: any) =>
    t.templateId === 'sayMessage' || t.type === 'SayMessage' || t.templateId === 'SayMessage'
  );

  if (!sayMessageTask) {
    console.warn('[DDTEngineMVP] ⚠️ No SayMessage task in escalation', { stepType, escalationNumber });
    return;
  }

  // Risolvi testo
  const textParam = sayMessageTask.parameters?.find((p: any) =>
    p.parameterId === 'text' || p.key === 'text' || p.parameterId === 'message'
  );

  if (!textParam?.value) {
    console.warn('[DDTEngineMVP] ⚠️ No text parameter in SayMessage task', { stepType, escalationNumber });
    return;
  }

  const raw = String(textParam.value).trim();
  const storeKey = translationKeyFromStoredValue(raw);
  const translatedText = storeKey ? (translations[storeKey] ?? '') : '';

  if (!translatedText || translatedText.trim().length === 0) {
    console.warn('[DDTEngineMVP] ⚠️ Translated text is empty', { raw, storeKey, stepType, escalationNumber });
    return;
  }

  if (callbacks.onMessage) {
    callbacks.onMessage(translatedText, stepType, escalationNumber);
    console.log('[DDTEngineMVP] ✅ Escalation message sent:', {
      stepType,
      escalationNumber,
      text: translatedText.substring(0, 50) + '...'
    });
  }
}

/**
 * Mostra messaggio Start
 */
async function showStartMessage(
  node: any,
  translations: Record<string, string>,
  callbacks: DDTNavigatorCallbacks
): Promise<void> {
  const startStep = node.steps?.start;
  if (!startStep?.escalations?.[0]) {
    console.error('[DDTEngineMVP] ❌ No start step or escalations found');
    return;
  }

  const escalation = startStep.escalations[0];
  await executeEscalation(escalation, translations, callbacks, 'start', 0);
}

/**
 * Mostra messaggio Success
 */
async function showSuccessMessage(
  node: any,
  translations: Record<string, string>,
  callbacks: DDTNavigatorCallbacks
): Promise<void> {
  const successStep = node.steps?.success;
  if (!successStep?.escalations?.[0]) {
    console.log('[DDTEngineMVP] ℹ️ No success step found, skipping success message');
    return;
  }

  const escalation = successStep.escalations[0];
  await executeEscalation(escalation, translations, callbacks, 'success', 0);
}

export async function runDDTMVP(
  ddtInstance: AssembledTaskTree,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  console.log('[DDTEngineMVP] 🚀 Starting MVP engine (FASE 2 - Escalation Base)', {
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

    // 2. Verifica callback necessari
    if (!callbacks.onMessage) {
      console.error('[DDTEngineMVP] ❌ onMessage callback not provided');
      return { success: false, error: new Error('onMessage callback not provided') };
    }

    if (!callbacks.onGetRetrieveEvent) {
      console.error('[DDTEngineMVP] ❌ onGetRetrieveEvent callback not provided');
      return { success: false, error: new Error('onGetRetrieveEvent callback not provided') };
    }

    // 3. Inizializza stato
    const state: DDTEngineState = {
      currentNodeId: firstNode.id,
      currentStepType: 'start',
      noMatchCounters: {},
      noInputCounters: {},
      memory: {}
    };

    const translations = callbacks.translations || {};

    // 4. Mostra messaggio Start (solo la prima volta)
    await showStartMessage(firstNode, translations, callbacks);

    // 5. Loop principale: attende input finché non c'è un Match
    while (true) {
      console.log('[DDTEngineMVP] ⏸️ Waiting for user input...', {
        nodeId: firstNode.id,
        currentStepType: state.currentStepType,
        noMatchCounter: state.noMatchCounters[firstNode.id] || 0,
        noInputCounter: state.noInputCounters[firstNode.id] || 0
      });

      const retrieveEvent = await callbacks.onGetRetrieveEvent(firstNode.id);

      console.log('[DDTEngineMVP] 📥 User input received:', {
        eventType: retrieveEvent.type,
        hasValue: 'value' in retrieveEvent,
        value: retrieveEvent.type === 'match' && 'value' in retrieveEvent ?
          (typeof retrieveEvent.value === 'string' ?
            retrieveEvent.value.substring(0, 50) + (retrieveEvent.value.length > 50 ? '...' : '') :
            retrieveEvent.value) :
          undefined,
        valueType: retrieveEvent.type === 'match' && 'value' in retrieveEvent ?
          typeof retrieveEvent.value :
          'N/A',
        valueTruthy: retrieveEvent.type === 'match' && 'value' in retrieveEvent ?
          !!retrieveEvent.value :
          false,
        currentStepType: state.currentStepType,
        fullEvent: retrieveEvent
      });

      // 6. Gestione Match: salva e mostra Success
      if (retrieveEvent.type === 'match') {
        console.log('[DDTEngineMVP] 🔍 Processing Match event:', {
          hasValue: 'value' in retrieveEvent,
          value: retrieveEvent.type === 'match' && 'value' in retrieveEvent ? retrieveEvent.value : undefined,
          valueTruthy: retrieveEvent.type === 'match' && 'value' in retrieveEvent ? !!retrieveEvent.value : false,
          valueType: retrieveEvent.type === 'match' && 'value' in retrieveEvent ? typeof retrieveEvent.value : 'N/A'
        });

        if (retrieveEvent.value) {
          const inputValue = retrieveEvent.value;
          console.log('[DDTEngineMVP] ✅ Input processed as Match:', {
            value: typeof inputValue === 'string' ? inputValue.substring(0, 50) + '...' : inputValue,
            valueType: typeof inputValue,
            valueLength: typeof inputValue === 'string' ? inputValue.length : 'N/A',
            valueTruthy: !!inputValue
          });

          // Salva in memory
          state.memory[firstNode.id] = { value: inputValue, confirmed: false };

          console.log('[DDTEngineMVP] 💾 Memory saved:', {
            nodeId: firstNode.id,
            value: typeof inputValue === 'string' ? inputValue.substring(0, 50) + '...' : inputValue,
            memoryKeys: Object.keys(state.memory),
            memorySize: Object.keys(state.memory).length
          });

          // Mostra Success
          console.log('[DDTEngineMVP] 📨 Showing success message...');
          await showSuccessMessage(firstNode, translations, callbacks);

          console.log('[DDTEngineMVP] ✅ MVP engine completed successfully');
          return { success: true, value: state.memory };
        } else {
          console.warn('[DDTEngineMVP] ⚠️ Match event but no value provided, treating as noMatch', {
            eventType: retrieveEvent.type,
            hasValue: 'value' in retrieveEvent,
            value: retrieveEvent.type === 'match' && 'value' in retrieveEvent ? retrieveEvent.value : undefined
          });
          // Tratta come noMatch se match ma senza valore - continua al blocco noMatch
        }
      }

      // 7. Gestione NoMatch: incrementa counter, mostra escalation, rimani nello stesso step
      // Gestisce anche il caso di match senza valore
      if (retrieveEvent.type === 'noMatch' || (retrieveEvent.type === 'match' && !retrieveEvent.value)) {
        const nodeId = firstNode.id;
        state.noMatchCounters[nodeId] = (state.noMatchCounters[nodeId] || 0) + 1;
        const counter = state.noMatchCounters[nodeId];

        console.log('[DDTEngineMVP] 🔄 NoMatch received:', {
          nodeId,
          counter,
          currentStepType: state.currentStepType
        });

        // Trova step NoMatch
        const noMatchStep = firstNode.steps?.noMatch;
        if (!noMatchStep || !noMatchStep.escalations || noMatchStep.escalations.length === 0) {
          console.warn('[DDTEngineMVP] ⚠️ No NoMatch step found, cannot escalate - remaining in wait');
          state.currentStepType = 'noMatch';
          continue; // Rimani in attesa
        }

        // Seleziona escalation (counter - 1 perché counter parte da 1, array è 0-indexed)
        // Se counter > escalations.length, ripete l'ultima
        const escalation = selectEscalation(noMatchStep, counter - 1);

        if (escalation) {
          await executeEscalation(escalation, translations, callbacks, 'noMatch', counter);
        } else {
          console.warn('[DDTEngineMVP] ⚠️ No escalation selected for NoMatch', { counter });
        }

        // ⚠️ IMPORTANTE: NON cambiare step, rimani in attesa di nuovo input
        state.currentStepType = 'noMatch';
        continue; // Loop continua, attende nuovo input
      }

      // 8. Gestione NoInput: incrementa counter, mostra escalation, rimani nello stesso step
      if (retrieveEvent.type === 'noInput') {
        const nodeId = firstNode.id;
        state.noInputCounters[nodeId] = (state.noInputCounters[nodeId] || 0) + 1;
        const counter = state.noInputCounters[nodeId];

        console.log('[DDTEngineMVP] 🔄 NoInput received:', {
          nodeId,
          counter,
          currentStepType: state.currentStepType
        });

        // Trova step NoInput
        const noInputStep = firstNode.steps?.noInput;
        if (!noInputStep || !noInputStep.escalations || noInputStep.escalations.length === 0) {
          console.warn('[DDTEngineMVP] ⚠️ No NoInput step found, cannot escalate - remaining in wait');
          state.currentStepType = 'noInput';
          continue; // Rimani in attesa
        }

        // Seleziona escalation (counter - 1 perché counter parte da 1, array è 0-indexed)
        const escalation = selectEscalation(noInputStep, counter - 1);

        if (escalation) {
          await executeEscalation(escalation, translations, callbacks, 'noInput', counter);
        } else {
          console.warn('[DDTEngineMVP] ⚠️ No escalation selected for NoInput', { counter });
        }

        // ⚠️ IMPORTANTE: NON cambiare step, rimani in attesa di nuovo input
        state.currentStepType = 'noInput';
        continue; // Loop continua, attende nuovo input
      }

      // 9. Altri eventi non gestiti
      console.warn('[DDTEngineMVP] ⚠️ Unhandled event type:', retrieveEvent);
      // Continua il loop in attesa di un evento valido
    }

  } catch (error) {
    console.error('[DDTEngineMVP] ❌ Error in MVP engine:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
