// DDT Engine - Nuova implementazione basata su logica proposta
// Implementazione parallela: NON tocca il codice esistente
// Permette test side-by-side e switch graduale

// DDT Engine - Backend Runtime
// Copied from frontend and adapted for backend

import type { AssembledDDT, MainDataNode, DDTNavigatorCallbacks } from './types';
import { getStep, getEscalationRecovery, executeStep } from './ddtSteps';
import { loadContract, findOriginalNode } from './utils';

// ✅ Import taskSemantics helper (shared between frontend and backend)
// Note: This assumes the backend can import from src/utils. If not, create a copy in backend/runtime/utils/
// For now, we'll create a local version to avoid path issues
function getTaskSemantics(ddt: any): 'Atomic' | 'CompositeData' | 'Collection' {
  const mainDataList = Array.isArray(ddt.mainData)
    ? ddt.mainData
    : ddt.mainData
    ? [ddt.mainData]
    : [];

  if (mainDataList.length === 1 && !mainDataList[0].subData?.length) {
    return 'Atomic';
  }
  if (mainDataList.length === 1 && mainDataList[0].subData?.length > 0) {
    return 'CompositeData';
  }
  if (mainDataList.length > 1) {
    const hasSubData = mainDataList.some(m => m.subData?.length > 0);
    if (hasSubData) {
      throw new Error('Collection cannot have mainData with subData');
    }
    return 'Collection';
  }
  return 'Atomic';
}

// ============================================================================
// TYPES
// ============================================================================

export type TurnState = 'Start' | 'NoMatch' | 'NoInput' | 'Confirmation' | 'NotConfirmed' | 'Success' | null;
export type TurnEvent = 'Match' | 'NoMatch' | 'NoInput' | 'Confirmed' | 'NotConfirmed' | 'Unknown';
export type Context = 'CollectingMain' | 'CollectingSub';

export interface TurnStateDescriptor {
  turnState: TurnState;
  context: Context;
  counter: number;
  nextDataId?: string; // Per context CollectingSub
}

export interface Response {
  message: string;
  tasks: Array<{ condition: boolean; action: () => void }>;
  stepType: string;
  escalationLevel?: number;
  stepOrEscalation?: any; // Step o escalation da eseguire con executeStep
}

export interface CurrentData {
  mainData: MainDataNode;
  subData?: MainDataNode;
  nodeId: string;
  isMain: boolean;
}

export interface Limits {
  noMatchMax: number;
  noInputMax: number;
  notConfirmedMax: number;
}

export interface Counters {
  noMatch: number;
  noInput: number;
  notConfirmed: number;
  confirmation: number;
}

export interface DDTEngineState {
  memory: Record<string, { value: any; confirmed: boolean }>;
  counters: Record<string, Counters>;
  currentMainId?: string;
  currentSubId?: string;
  turnState: TurnState;
  context: Context;
}

export interface RetrieveResult {
  success: boolean;
  value?: any;
  exit?: boolean;
  exitAction?: any;
  error?: Error;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LIMITS: Limits = {
  noMatchMax: 3,
  noInputMax: 3,
  notConfirmedMax: 2
};

// ============================================================================
// 🔄 FUNZIONE PRINCIPALE: RunDDT
// ============================================================================

export async function runDDT(
  ddtInstance: AssembledDDT,
  callbacks: DDTNavigatorCallbacks,
  limits: Limits = DEFAULT_LIMITS
): Promise<RetrieveResult> {
  const tStart = performance.now();
  console.log('[DDTEngine] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngine] 🆕🆕🆕 NEW ENGINE ACTIVE 🆕🆕🆕');
  console.log('[DDTEngine] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngine][runDDT] Starting NEW engine', {
    ddtId: ddtInstance.id,
    ddtLabel: ddtInstance.label,
    hasMainData: !!ddtInstance.mainData,
    timestamp: new Date().toISOString()
  });

  // Inizializzazione
  let state = initializeState(ddtInstance);

  // Store DDT instance for contract loading (needed for canonicalKey → subId mapping)
  (state as any).__ddtInstance = ddtInstance;

  // Se DDT è di tipo Aggregate, mostra Preamble
  if (ddtInstance.introduction) {
    console.log('[DDTEngine][runDDT] Playing introduction/Preamble');
    await playIntroduction(ddtInstance.introduction, callbacks);
  }

  // Ciclo principale deterministico
  let loopIteration = 0;
  while (true) {
    loopIteration++;
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`[DDTEngine][runDDT] 🔄 Loop iteration ${loopIteration}`, {
      turnState: state.turnState,
      context: state.context,
      memoryKeys: Object.keys(state.memory),
      memoryState: Object.keys(state.memory).map(key => ({
        key,
        hasValue: !!state.memory[key]?.value,
        confirmed: state.memory[key]?.confirmed,
        valueType: typeof state.memory[key]?.value
      }))
    });
    console.log('═══════════════════════════════════════════════════════════════════════════');

    // 1. Trova il prossimo dato da raccogliere
    const currData = getNextData(ddtInstance, state);
    console.log('[DDTEngine][runDDT] getNextData returned', {
      isNull: currData === null,
      nodeId: currData?.nodeId,
      isMain: currData?.isMain,
      nodeLabel: currData?.mainData?.label || currData?.subData?.label
    });

    if (currData === null) {
      // Tutti i dati sono stati raccolti
      console.log('[DDTEngine][runDDT] All data collected, returning success');
      return { success: true, value: state.memory };
    }

    // 2. Determina lo stato corrente del nodo
    const nodeState = getNodeState(state, currData.nodeId);
    const turnState = nodeState.step;
    const counters = nodeState.counters;

    // Log ridotto - solo per debug se necessario

    // 3. Seleziona la risposta (step/escalation) da mostrare
    const currResponse = getResponse(
      currData,
      turnState,
      counters,
      limits
    );

    // 4. Esegui la risposta (mostra messaggio, esegui azioni) usando executeStep esistente
    await executeResponse(currResponse, callbacks, currData, state);

    // 5. Attendi input e processa per ottenere TurnEvent
    const currTurnEvent = await processUserInput(
      currData,
      callbacks,
      state,
      currResponse.stepType
    );

    console.log('[DDTEngine][runDDT] 🆕 NEW ENGINE: Turn event received', {
      event: currTurnEvent,
      nodeId: currData.nodeId,
      timestamp: new Date().toISOString(),
      memoryKeys: Object.keys(state.memory),
      memoryState: Object.keys(state.memory).map(key => ({ key, hasValue: !!state.memory[key]?.value, confirmed: state.memory[key]?.confirmed }))
    });

    // 6. Se c'è NoMatch o NoInput, mostra escalation immediatamente
    if (currTurnEvent === 'NoMatch' || currTurnEvent === 'NoInput') {
      // Incrementa counter
      const newCounter =
        currTurnEvent === 'NoMatch'
          ? Math.min(counters.noMatch + 1, limits.noMatchMax)
          : Math.min(counters.noInput + 1, limits.noInputMax);

      // Aggiorna counters
      const nodeId = currData.nodeId;
      if (state.counters[nodeId]) {
        if (currTurnEvent === 'NoMatch') {
          state.counters[nodeId].noMatch = newCounter;
        } else {
          state.counters[nodeId].noInput = newCounter;
        }
      }

      // Mostra escalation
      const targetNode = currData.isMain ? currData.mainData : currData.subData!;
      const stepType = currTurnEvent === 'NoMatch' ? 'noMatch' : 'noInput';
      const step = getStep(targetNode, stepType);
      if (step) {
        const recovery = getEscalationRecovery(step, stepType, newCounter);
        if (recovery) {
          await executeStep(recovery, callbacks, stepType, newCounter);
        }
      }

      // Torna a Start per riprovare
      state.turnState = 'Start';
      state.context = currData.isMain ? 'CollectingMain' : 'CollectingSub';
      continue; // Continua ciclo per chiedere di nuovo
    }

    // 7. Gestisci transizione di stato basata sull'evento
    console.log('[DDTEngine][runDDT] 🔄 Calling getState', {
      event: currTurnEvent,
      nodeId: currData.nodeId,
      currentTurnState: turnState,
      memoryKeys: Object.keys(state.memory)
    });
    const turnStateDesc = getState(
      currTurnEvent,
      currData,
      turnState,
      counters,
      limits,
      state,
      ddtInstance
    );
    console.log('[DDTEngine][runDDT] ✅ getState returned', {
      nextTurnState: turnStateDesc.turnState,
      context: turnStateDesc.context,
      nextDataId: turnStateDesc.nextDataId
    });

      // 8. Aggiorna stato globale
      state = updateState(state, turnStateDesc, currData);
      console.log('[DDTEngine][runDDT] ✅ State updated', {
        turnState: state.turnState,
        context: state.context,
        memoryKeys: Object.keys(state.memory)
      });

      // Log solo per transizioni importanti
      if (turnStateDesc.turnState === 'Confirmation' || turnStateDesc.turnState === 'Success') {
        console.log('[DDTEngine] 🔄 State transition', {
          event: currTurnEvent,
          nextTurnState: turnStateDesc.turnState,
          memoryKeys: Object.keys(state.memory)
        });
      }

    // 9. Se siamo andati a Confirmation, esegui step Confirmation prima di continuare
    if (turnStateDesc.turnState === 'Confirmation') {
      console.log('[DDTEngine][runDDT] 🔄 Going to Confirmation, executing confirmation step');
      console.log('[DDTEngine][runDDT] 📊 State before confirmation', {
        turnState: state.turnState,
        context: state.context,
        memoryKeys: Object.keys(state.memory),
        memoryValues: Object.keys(state.memory).map(key => ({
          key,
          hasValue: !!state.memory[key]?.value,
          value: state.memory[key]?.value,
          confirmed: state.memory[key]?.confirmed
        }))
      });

      // Ottieni la risposta per Confirmation
      const confirmationResponse = getResponse(
        currData,
        'Confirmation',
        counters,
        limits
      );

      console.log('[DDTEngine][runDDT] 📋 Confirmation response prepared', {
        stepType: confirmationResponse.stepType,
        hasStepOrEscalation: !!confirmationResponse.stepOrEscalation,
        message: confirmationResponse.message
      });

      // Esegui il messaggio di conferma
      await executeResponse(confirmationResponse, callbacks, currData, state);

      console.log('[DDTEngine][runDDT] ✅ Confirmation message sent, continuing loop to wait for user input');
      continue; // Continua ciclo per attendere input utente (conferma o negazione)
    }

    // 10. Se siamo andati a Success, esegui step Success prima di terminare
    if (turnStateDesc.turnState === 'Success') {
      const targetNode = currData.isMain ? currData.mainData : currData.subData!;
      const successStep = getStep(targetNode, 'success');
      if (successStep) {
        await executeStep(successStep, callbacks, 'success', 0);
      }

      // Dopo Success, controlla se ci sono altri dati o termina
      const nextData = peekNextData(ddtInstance, state);
      if (nextData === null) {
        console.log('[DDTEngine][runDDT] All data collected, exiting');
        break;
      } else {
        // Continua con prossimo dato
        continue;
      }
    }

    // 11. Controlla condizione di uscita
    if (turnStateDesc.turnState === null) {
      console.log('[DDTEngine][runDDT] TurnState is null, exiting loop');
      break;
    }
  }

  // Fine dialogo
  const tEnd = performance.now();
  console.log('[DDTEngine] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngine] ✅ NEW ENGINE completed successfully');
  console.log('[DDTEngine] ═══════════════════════════════════════════════════════');
  console.log('[DDTEngine][runDDT] Returning success', {
    memoryKeys: Object.keys(state.memory),
    memoryCount: Object.keys(state.memory).length,
    totalMs: Math.round(tEnd - tStart)
  });
  return { success: true, value: state.memory };
}

// ============================================================================
// 🔎 GetNextData - Trova il prossimo dato vuoto
// ============================================================================

/**
 * Finds the next empty data to collect
 * ✅ Handles Atomic, CompositeData, and Collection
 * ✅ Uses referenceId from instance (not recalculated from template)
 */
function getNextData(
  ddtInstance: AssembledDDT,
  state: DDTEngineState
): CurrentData | null {
  // Normalizza mainData (può essere array o singolo oggetto)
  const mainDataList = Array.isArray(ddtInstance.mainData)
    ? ddtInstance.mainData
    : ddtInstance.mainData
    ? [ddtInstance.mainData]
    : [];

  // ✅ Deduce semantics from structure
  const semantics = getTaskSemantics(ddtInstance);

  // ✅ For Collection: iterate over all mainData[] (each is independent)
  // ✅ For Atomic/CompositeData: iterate over mainData[0] and its subData
  for (const mainData of mainDataList) {
    // ✅ Runtime: use referenceId from instance (not recalculated from template)
    const mainDataId = (mainData as any).referenceId || mainData.id;
    const mainMemory = state.memory[mainDataId];
    const mainValue = mainMemory?.value;
    const isMainEmpty =
      !mainValue ||
      (typeof mainValue === 'object' &&
        Object.keys(mainValue).length === 0) ||
      mainValue === null ||
      mainValue === undefined;

    // Se mainData è vuoto, ritorna mainData
    if (isMainEmpty) {
      return {
        mainData,
        nodeId: mainDataId,
        isMain: true
      };
    }

    // Se mainData richiede confirmation, controlla se è confirmed
    if (requiresConfirmation(mainData)) {
      const isMainConfirmed = mainMemory?.confirmed === true;
      // Se non è confirmed, ritorna mainData (per confirmation)
      if (!isMainConfirmed) {
        return {
          mainData,
          nodeId: mainDataId,
          isMain: true
        };
      }
      // Se è confirmed, continua al prossimo mainData o controlla subData
    }

    // ✅ For Collection: skip subData check (Collection cannot have subData)
    if (semantics === 'Collection') {
      // Collection: all mainData[] are independent, continue to next mainData
      continue;
    }

    // ✅ For CompositeData: check if any subData is empty
    if (mainData.subData && Array.isArray(mainData.subData)) {
      const requiredSubs = mainData.subData.filter(
        (sub) => sub.required !== false
      );

      for (const subData of requiredSubs) {
        // ✅ Runtime: use referenceId from instance (not recalculated from template)
        const subDataId = (subData as any).referenceId || subData.id;
        const subValue = state.memory[subDataId]?.value;
        const isSubEmpty =
          !subValue ||
          subValue === null ||
          subValue === undefined ||
          (typeof subValue === 'string' && subValue.trim().length === 0);

        if (isSubEmpty) {
          // SubData vuoto → ritorna subData
          return {
            mainData,
            subData,
            nodeId: subDataId,
            isMain: false
          };
        }
      }
    }

    // MainData e tutti i suoi sub sono pieni → continua al prossimo main
  }

  // Nessun dato vuoto trovato
  return null;
}

// ============================================================================
// 🗣️ GetResponse - Selettore di tasklist (Steps)
// ============================================================================

function getResponse(
  currData: CurrentData,
  turnState: TurnState,
  counters: Counters,
  limits: Limits
): Response {
  // Determina il nodo target (main o sub)
  const targetNode = currData.isMain ? currData.mainData : currData.subData!;

  if (!targetNode) {
    return {
      message: 'Error: target node not found',
      tasks: [],
      stepType: 'unknown',
      escalationLevel: 0
    };
  }

  // Switch basato su turnState
  switch (turnState) {
    case 'Start': {
      // Step iniziale: mostra domanda normale
      const step = getStep(targetNode, 'start');
      const escalationLevel = Math.min(counters.noMatch, limits.noMatchMax);
      return {
        message: '', // Sarà risolto da executeStep
        tasks: [],
        stepType: 'start',
        escalationLevel,
        stepOrEscalation: step
      };
    }

    case 'NoMatch': {
      // Escalation noMatch
      const newCounter = Math.min(counters.noMatch + 1, limits.noMatchMax);
      const step = getStep(targetNode, 'noMatch');
      const escalationLevel = newCounter;
      const recovery = step ? getEscalationRecovery(step, 'noMatch', escalationLevel) : null;
      return {
        message: '', // Sarà risolto da executeStep
        tasks: [],
        stepType: 'noMatch',
        escalationLevel,
        stepOrEscalation: recovery || step
      };
    }

    case 'NoInput': {
      // Escalation noInput
      const newCounter = Math.min(counters.noInput + 1, limits.noInputMax);
      const step = getStep(targetNode, 'noInput');
      const escalationLevel = newCounter;
      const recovery = step ? getEscalationRecovery(step, 'noInput', escalationLevel) : null;
      return {
        message: '', // Sarà risolto da executeStep
        tasks: [],
        stepType: 'noInput',
        escalationLevel,
        stepOrEscalation: recovery || step
      };
    }

    case 'Confirmation': {
      // Chiedo conferma del dato raccolto
      const step = getStep(targetNode, 'confirmation');
      return {
        message: '', // Sarà risolto da executeStep
        tasks: [],
        stepType: 'confirmation',
        escalationLevel: 0,
        stepOrEscalation: step
      };
    }

    case 'NotConfirmed': {
      // Dato non confermato, escalation
      const newCounter = Math.min(
        counters.notConfirmed + 1,
        limits.notConfirmedMax
      );
      const step = getStep(targetNode, 'notConfirmed');
      const escalationLevel = newCounter;
      const recovery = step ? getEscalationRecovery(step, 'notConfirmed', escalationLevel) : null;
      return {
        message: '', // Sarà risolto da executeStep
        tasks: [],
        stepType: 'notConfirmed',
        escalationLevel,
        stepOrEscalation: recovery || step
      };
    }

    case 'Success': {
      // Dato confermato, step finale
      const step = getStep(targetNode, 'success');
      return {
        message: '', // Sarà risolto da executeStep
        tasks: [],
        stepType: 'success',
        escalationLevel: 0,
        stepOrEscalation: step
      };
    }

    default:
      return {
        message: 'Evento non gestito',
        tasks: [],
        stepType: 'unknown',
        escalationLevel: 0
      };
  }
}

// ============================================================================
// ▶️ ExecuteResponse - Esegue messaggio/azioni usando executeStep esistente
// ============================================================================

async function executeResponse(
  response: Response,
  callbacks: DDTNavigatorCallbacks,
  currData?: CurrentData,
  state?: DDTEngineState
): Promise<void> {
  // Usa executeStep esistente per eseguire step/escalation
  // response contiene già step/escalation estratti

  // Se è confirmation, recupera i valori dalla memoria per sostituire {input}
  let inputValue: any = undefined;
  if (response.stepType === 'confirmation' && currData && state) {
    console.log('[DDTEngine][executeResponse] 🔄 Preparing confirmation message', {
      stepType: response.stepType,
      hasCurrData: !!currData,
      hasState: !!state,
      memoryKeys: Object.keys(state.memory || {})
    });

    const mainData = currData.mainData;

    // Se mainData ha subData, formatta tutti i valori
    if (mainData.subData && Array.isArray(mainData.subData) && mainData.subData.length > 0) {
      const values: string[] = [];
      for (const subData of mainData.subData) {
        // ✅ Runtime: use referenceId from instance (not recalculated from template)
        const subDataId = (subData as any).referenceId || subData.id;
        const subValue = state.memory[subDataId]?.value;
        if (subValue !== undefined && subValue !== null) {
          values.push(String(subValue));
        }
      }
      inputValue = values.join(' ');
      console.log('[DDTEngine][executeResponse] ✅ Formatted input value from subData', {
        inputValue,
        subDataCount: mainData.subData.length
      });
    } else {
      // MainData atomico
      // ✅ Runtime: use referenceId from instance (not recalculated from template)
      const mainDataId = (mainData as any).referenceId || mainData.id;
      const mainValue = state.memory[mainDataId]?.value;
      if (mainValue !== undefined && mainValue !== null) {
        inputValue = mainValue;
        console.log('[DDTEngine][executeResponse] ✅ Got input value from mainData', {
          inputValue,
          mainDataId
        });
      } else {
        console.warn('[DDTEngine][executeResponse] ⚠️ No value found in memory for confirmation', {
          mainDataId,
          memoryKeys: Object.keys(state.memory || {})
        });
      }
    }
  }

  if (response.stepOrEscalation) {
    console.log('[DDTEngine][executeResponse] 🚀 Executing step', {
      stepType: response.stepType,
      escalationLevel: response.escalationLevel,
      hasInputValue: inputValue !== undefined,
      inputValue: inputValue !== undefined ? String(inputValue).substring(0, 50) : undefined
    });
    await executeStep(
      response.stepOrEscalation,
      callbacks,
      response.stepType,
      response.escalationLevel,
      inputValue
    );
    console.log('[DDTEngine][executeResponse] ✅ Step executed', {
      stepType: response.stepType
    });
  } else {
    console.warn('[DDTEngine][executeResponse] ⚠️ No step or escalation to execute', {
      stepType: response.stepType,
      hasStepOrEscalation: !!response.stepOrEscalation
    });
  }
}

// ============================================================================
// 🔄 ProcessUserInput - Processa input utente e produce TurnEvent
// ============================================================================

async function processUserInput(
  currData: CurrentData,
  callbacks: DDTNavigatorCallbacks,
  state: DDTEngineState,
  stepType: string
): Promise<TurnEvent> {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('[DDTEngine][processUserInput] 🚀 START processing user input', {
    nodeId: currData.nodeId,
    isMain: currData.isMain,
    stepType,
    hasOnGetRetrieveEvent: !!callbacks.onGetRetrieveEvent
  });
  console.log('═══════════════════════════════════════════════════════════════════════════');

  // 1. Attendi input utente
  if (!callbacks.onGetRetrieveEvent) {
    throw new Error('onGetRetrieveEvent callback not provided');
  }

  const nodeId = currData.nodeId;
  const node = currData.isMain ? currData.mainData : currData.subData!;

  // ✅ Carica contract come fa il vecchio engine (per mapping canonicalKey → subId)
  // Il contract DEVE essere caricato dall'originalNode nel DDT (come fa useNewFlowOrchestrator)
  let contract: any = null;

  try {
    // ✅ Use backend utilities instead of dynamic imports

    // Cerca l'originalNode nel DDT (come fa useNewFlowOrchestrator)
    if ((state as any).__ddtInstance) {
      const ddtInstance = (state as any).__ddtInstance;
      const originalNode = findOriginalNode(ddtInstance, node?.label, nodeId);

      if (originalNode) {
        contract = loadContract(originalNode);
      }
    }

    // Fallback: prova a caricare direttamente dal node
    if (!contract) {
      contract = loadContract(node);
      if (contract) {
        console.log('[DDTEngine][processUserInput] ✅ Contract loaded from node (fallback)');
      }
    }
  } catch (error) {
    console.warn('[DDTEngine][processUserInput] Failed to load contract', error);
  }

  const t0 = performance.now();
  console.log('[DDTEngine][processUserInput] ⏳ Calling onGetRetrieveEvent', { nodeId, hasCallback: !!callbacks.onGetRetrieveEvent });
  const userInputEvent = await callbacks.onGetRetrieveEvent(nodeId);
  const t1 = performance.now();
  console.log('[DDTEngine][processUserInput][PERF] onGetRetrieveEvent resolved', {
    ms: Math.round(t1 - t0),
    eventType: userInputEvent.type,
    hasValue: !!(userInputEvent as any).value
  });

  // 2. Processa input tramite contract (regex/NER/LLM)
  let recognitionResult: {
    status: 'match' | 'noMatch' | 'noInput' | 'partialMatch';
    value?: any;
    matchedButInvalid?: boolean;
  };

  if (userInputEvent.type === 'match' && callbacks.onProcessInput && userInputEvent.value) {
    // Processa input raw
    const t2 = performance.now();
    recognitionResult = await callbacks.onProcessInput(
      userInputEvent.value,
      node
    );
    const t3 = performance.now();
    console.log('[DDTEngine][processUserInput][PERF] onProcessInput', { ms: Math.round(t3 - t2) });

    // Log solo se necessario
    if (recognitionResult.status === 'match' && recognitionResult.value) {
      console.log('[DDTEngine][processUserInput] ✅ Match extracted', {
        valueKeys: typeof recognitionResult.value === 'object' ? Object.keys(recognitionResult.value) : [],
        value: recognitionResult.value
      });
    }
  } else if (userInputEvent.type === 'noInput') {
    recognitionResult = { status: 'noInput' };
  } else if (userInputEvent.type === 'noMatch') {
    recognitionResult = { status: 'noMatch' };
  } else {
    recognitionResult = { status: 'noMatch' };
  }

  // 3. Determina TurnEvent basato su recognitionResult
  if (stepType === 'confirmation') {
    // Gestione speciale per Confirmation
    const inputText =
      typeof userInputEvent === 'object' && 'value' in userInputEvent
        ? String(userInputEvent.value || '')
        : '';

    if (isYes(inputText)) {
      return 'Confirmed';
    } else if (isNo(inputText)) {
      return 'NotConfirmed';
    } else {
      // Input non riconosciuto come yes/no → noMatch
      return 'NoMatch';
    }
  }

  switch (recognitionResult.status) {
    case 'match':
      if (recognitionResult.matchedButInvalid) {
        return 'NoMatch';
      } else {
        // Salva valore in memory
        // Se mainData ha subData e il valore è un oggetto, decomponi e salva ogni subData
        // Il contract estrae valori con chiavi canonicalKey ("day", "month", "year")
        // Devo mappare canonicalKey → subData.id usando getSubIdForCanonicalKey (come fa il vecchio engine)
        if (currData.isMain && recognitionResult.value && typeof recognitionResult.value === 'object') {
          const mainData = currData.mainData;
          if (mainData.subData && Array.isArray(mainData.subData)) {
            // Log essenziale

            // ✅ USA LO STESSO METODO DEL VECCHIO ENGINE: getSubIdForCanonicalKey
            let mappedCount = 0;
            // ✅ Use backend utility instead of dynamic import

            if (contract && contract.subDataMapping) {
              // ✅ SIMPLIFIED: recognitionResult.value is already keyed by subId (no canonicalKey mapping needed)
              const tMap = performance.now();
              for (const [subId, value] of Object.entries(recognitionResult.value)) {
                if (contract.subDataMapping[subId]) {
                  updateMemory(state, subId, value);
                  mappedCount++;
                }
              }
              const tMapEnd = performance.now();
              console.log('[DDTEngine][PERF] ✅ Mapped', { mappedCount, total: Object.keys(recognitionResult.value).length, ms: Math.round(tMapEnd - tMap) });
            } else {
              console.warn('[DDTEngine] ⚠️ No contract for mapping');
            }

            // Fallback: prova a mappare usando id, label, name direttamente
            if (mappedCount === 0) {
              for (const subData of mainData.subData) {
                // ✅ Runtime: use referenceId from instance (not recalculated from template)
                const subDataId = (subData as any).referenceId || subData.id;
                const subValue = recognitionResult.value[subData.id] ||
                                recognitionResult.value[subData.label] ||
                                recognitionResult.value[subData.name];
                if (subValue !== undefined && subValue !== null) {
                  updateMemory(state, subDataId, subValue);
                  mappedCount++;
                }
              }
            }

            // Salva anche l'oggetto completo sotto mainData.referenceId per riferimento
            // ✅ Runtime: use referenceId from instance (not recalculated from template)
            const mainDataId = (currData.mainData as any).referenceId || currData.nodeId;
            updateMemory(state, mainDataId, recognitionResult.value);
          } else {
            // MainData atomico, salva direttamente
            updateMemory(state, currData.nodeId, recognitionResult.value);
          }
        } else {
          // SubData o valore non oggetto, salva direttamente
          updateMemory(state, currData.nodeId, recognitionResult.value);
        }
        return 'Match';
      }

    case 'noMatch':
      return 'NoMatch';

    case 'noInput':
      return 'NoInput';

    case 'partialMatch':
      // Match parziale: tratta come match
      // Stessa logica di decomposizione per partialMatch
      if (currData.isMain && recognitionResult.value && typeof recognitionResult.value === 'object') {
        const mainData = currData.mainData;
        if (mainData.subData && Array.isArray(mainData.subData)) {
          for (const subData of mainData.subData) {
            // ✅ Runtime: use referenceId from instance (not recalculated from template)
            const subDataId = (subData as any).referenceId || subData.id;
            const subValue = recognitionResult.value[subData.id] ||
                            recognitionResult.value[subData.label] ||
                            recognitionResult.value[subData.name];
            if (subValue !== undefined && subValue !== null) {
              updateMemory(state, subDataId, subValue);
            }
          }
          // ✅ Runtime: use referenceId from instance (not recalculated from template)
          const mainDataId = (mainData as any).referenceId || currData.nodeId;
          updateMemory(state, mainDataId, recognitionResult.value);
        } else {
          // ✅ Runtime: use referenceId from instance (not recalculated from template)
          const mainDataId = (mainData as any).referenceId || currData.nodeId;
          updateMemory(state, mainDataId, recognitionResult.value);
        }
      } else {
        // ✅ Runtime: use referenceId from instance (not recalculated from template)
        // currData.nodeId should already be referenceId if set correctly in getNextData
        updateMemory(state, currData.nodeId, recognitionResult.value);
      }
      return 'Match';

    default:
      return 'Unknown';
  }
}

// ============================================================================
// 🔄 GetState - Gestione transizione di stato + escalation
// ============================================================================

function getState(
  currTurnEvent: TurnEvent,
  currData: CurrentData,
  prevState: TurnState,
  counters: Counters,
  limits: Limits,
  state: DDTEngineState,
  ddtInstance: AssembledDDT
): TurnStateDescriptor {
  switch (currTurnEvent) {
    case 'Match': {
      // Match rilevante → aggiorna memory e determina prossimo stato
      if (!currData.isMain) {
        // Siamo in CollectingSub e il sub è stato riempito
        const mainData = currData.mainData;
        const missingSubs = findMissingRequiredSubs(mainData, state.memory);

        if (missingSubs.length > 0) {
          // Ci sono ancora sub mancanti → continua a raccogliere sub
          return {
            turnState: 'Start',
            context: 'CollectingSub',
            counter: 0,
            nextDataId: missingSubs[0].id
          };
        } else {
          // Tutti i sub sono pieni → controlla se serve confirmation
          if (requiresConfirmation(mainData)) {
            return {
              turnState: 'Confirmation',
              context: 'CollectingMain',
              counter: 0
            };
          } else {
            return {
              turnState: 'Success',
              context: 'CollectingMain',
              counter: 0
            };
          }
        }
      } else {
        // Siamo in CollectingMain
        const mainData = currData.mainData;

        // Controlla se mainData ha subData e se sono tutti pieni
        if (mainData.subData && mainData.subData.length > 0) {
          const missingSubs = findMissingRequiredSubs(mainData, state.memory);

          console.log('[DDTEngine] 🔍 Match: checking subData', {
            totalSubs: mainData.subData.length,
            missingCount: missingSubs.length,
            memoryKeys: Object.keys(state.memory),
            subDataCheck: mainData.subData.map(s => {
              // ✅ Runtime: use referenceId from instance (not recalculated from template)
              const subDataId = (s as any).referenceId || s.id;
              return {
                id: subDataId.substring(0, 20) + '...',
                inMemory: !!state.memory[subDataId],
                value: state.memory[subDataId]?.value
              };
            })
          });

          if (missingSubs.length > 0) {
            // Ci sono sub mancanti → passa a CollectingSub
            return {
              turnState: 'Start',
              context: 'CollectingSub',
              counter: 0,
              nextDataId: missingSubs[0].id
            };
          } else {
            // Tutti i sub sono pieni → confirmation o success
            if (requiresConfirmation(mainData)) {
              console.log('[DDTEngine] ✅ All subs filled → Confirmation');
              return {
                turnState: 'Confirmation',
                context: 'CollectingMain',
                counter: 0
              };
            } else {
              return {
                turnState: 'Success',
                context: 'CollectingMain',
                counter: 0
              };
            }
          }
        } else {
          // MainData atomico (senza sub) → confirmation o success
          if (requiresConfirmation(mainData)) {
            console.log('[DDTEngine] ✅ Atomic mainData → Confirmation');
            return {
              turnState: 'Confirmation',
              context: 'CollectingMain',
              counter: 0
            };
          } else {
            return {
              turnState: 'Success',
              context: 'CollectingMain',
              counter: 0
            };
          }
        }
      }
    }

    case 'NoMatch': {
      // NoMatch → incrementa counter, mostra escalation, poi torna a Start
      const newCounter = Math.min(counters.noMatch + 1, limits.noMatchMax);
      // Nota: lo step NoMatch verrà eseguito nel prossimo ciclo quando turnState sarà 'NoMatch'
      return {
        turnState: 'NoMatch',
        context: currData.isMain ? 'CollectingMain' : 'CollectingSub',
        counter: newCounter
      };
    }

    case 'NoInput': {
      // NoInput → incrementa counter, mostra escalation, poi torna a Start
      const newCounter = Math.min(counters.noInput + 1, limits.noInputMax);
      // Nota: lo step NoInput verrà eseguito nel prossimo ciclo quando turnState sarà 'NoInput'
      return {
        turnState: 'NoInput',
        context: currData.isMain ? 'CollectingMain' : 'CollectingSub',
        counter: newCounter
      };
    }

    case 'Confirmed': {
      // Conferma positiva → Success (lo step Success verrà eseguito nel ciclo)
      markAsConfirmed(state, currData.nodeId);
      return {
        turnState: 'Success',
        context: 'CollectingMain',
        counter: 0
      };
    }

    case 'NotConfirmed': {
      // Conferma negativa → NotConfirmed e torna a Start
      const newCounter = Math.min(
        counters.notConfirmed + 1,
        limits.notConfirmedMax
      );
      return {
        turnState: 'NotConfirmed',
        context: 'CollectingMain',
        counter: newCounter
      };
    }

    case 'Unknown': {
      // Evento sconosciuto → gestisci come noMatch
      return getState(
        'NoMatch',
        currData,
        prevState,
        counters,
        limits,
        state,
        ddtInstance
      );
    }

    default:
      return {
        turnState: null,
        context: 'CollectingMain',
        counter: 0
      };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function initializeState(ddtInstance: AssembledDDT): DDTEngineState {
  const state: DDTEngineState = {
    memory: {},
    counters: {},
    turnState: 'Start',
    context: 'CollectingMain'
  };

  // Normalizza mainData
  const mainDataList = Array.isArray(ddtInstance.mainData)
    ? ddtInstance.mainData
    : ddtInstance.mainData
    ? [ddtInstance.mainData]
    : [];

  // Inizializza counters per tutti i nodi
  for (const mainData of mainDataList) {
    state.counters[mainData.id] = {
      noMatch: 0,
      noInput: 0,
      notConfirmed: 0,
      confirmation: 0
    };

    if (mainData.subData && Array.isArray(mainData.subData)) {
      for (const subData of mainData.subData) {
        state.counters[subData.id] = {
          noMatch: 0,
          noInput: 0,
          notConfirmed: 0,
          confirmation: 0
        };
      }
    }
  }

  return state;
}

function updateMemory(
  state: DDTEngineState,
  nodeId: string,
  value: any
): void {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('[DDTEngine] 💾 Saving to memory', {
    nodeId,
    valueType: typeof value,
    isObject: typeof value === 'object' && value !== null,
    valueKeys: typeof value === 'object' && value !== null ? Object.keys(value) : [],
    value: typeof value === 'string' ? value.substring(0, 100) : value
  });
  console.log('═══════════════════════════════════════════════════════════════════════════');
  if (state.memory[nodeId]) {
    state.memory[nodeId].value = value;
    console.log('[DDTEngine] ✅ Memory updated (existing entry)', { nodeId, hasValue: !!state.memory[nodeId].value });
  } else {
    state.memory[nodeId] = { value, confirmed: false };
    console.log('[DDTEngine] ✅ Memory created (new entry)', { nodeId, hasValue: !!state.memory[nodeId].value });
  }
  console.log('[DDTEngine] 📊 Memory state after update', {
    totalKeys: Object.keys(state.memory).length,
    keys: Object.keys(state.memory),
    nodeIdValue: state.memory[nodeId]?.value
  });
}

function markAsConfirmed(state: DDTEngineState, nodeId: string): void {
  if (state.memory[nodeId]) {
    state.memory[nodeId].confirmed = true;
  }
}

/**
 * Finds missing required subData for a mainData node
 * ✅ Uses referenceId from instance (not recalculated from template)
 * ✅ Handles CompositeData: checks all subData
 */
function findMissingRequiredSubs(
  mainData: MainDataNode,
  memory: Record<string, { value: any; confirmed: boolean }>
): MainDataNode[] {
  const missingSubs: MainDataNode[] = [];

  if (!mainData.subData || !Array.isArray(mainData.subData)) {
    return missingSubs;
  }

  for (const subData of mainData.subData) {
    if (subData.required !== false) {
      // ✅ Runtime: use referenceId from instance (not recalculated from template)
      const dataId = (subData as any).referenceId || subData.id;
      const subValue = memory[dataId]?.value;
      const isSubEmpty =
        !subValue ||
        subValue === null ||
        subValue === undefined ||
        (typeof subValue === 'string' && subValue.trim().length === 0);

      if (isSubEmpty) {
        missingSubs.push(subData);
      }
    }
  }

  return missingSubs;
}

/**
 * Checks if a mainData node is saturated
 * ✅ Uses referenceId from instance (not recalculated from template)
 */
function isMainDataSaturated(
  mainData: MainDataNode,
  memory: Record<string, { value: any; confirmed: boolean }>
): boolean {
  // ✅ Runtime: use referenceId from instance (not recalculated from template)
  const dataId = (mainData as any).referenceId || mainData.id;
  const mainValue = memory[dataId]?.value;
  const isMainEmpty =
    !mainValue ||
    (typeof mainValue === 'object' && Object.keys(mainValue).length === 0) ||
    mainValue === null ||
    mainValue === undefined;

  if (isMainEmpty) {
    return false;
  }

  // If has subData, check all are saturated
  if (mainData.subData && Array.isArray(mainData.subData) && mainData.subData.length > 0) {
    return findMissingRequiredSubs(mainData, memory).length === 0;
  }

  return true;
}

function peekNextData(
  ddtInstance: AssembledDDT,
  state: DDTEngineState
): CurrentData | null {
  // Simula GetNextData senza modificare lo stato
  return getNextData(ddtInstance, state);
}

function updateState(
  state: DDTEngineState,
  turnStateDesc: TurnStateDescriptor,
  currData: CurrentData
): DDTEngineState {
  // Aggiorna turnState globale
  state.turnState = turnStateDesc.turnState;
  state.context = turnStateDesc.context;

  // Aggiorna currentMainId e currentSubId
  if (turnStateDesc.context === 'CollectingMain') {
    state.currentMainId = currData.mainData.id;
    state.currentSubId = undefined;
  } else {
    state.currentMainId = currData.mainData.id;
    state.currentSubId = turnStateDesc.nextDataId;
  }

  // Aggiorna counters del nodo corrente
  const nodeId = currData.nodeId;
  if (state.counters[nodeId]) {
    if (turnStateDesc.turnState === 'NoMatch') {
      state.counters[nodeId].noMatch = turnStateDesc.counter;
    } else if (turnStateDesc.turnState === 'NoInput') {
      state.counters[nodeId].noInput = turnStateDesc.counter;
    } else if (turnStateDesc.turnState === 'NotConfirmed') {
      state.counters[nodeId].notConfirmed = turnStateDesc.counter;
    }
  }

  return state;
}

function getNodeState(
  state: DDTEngineState,
  nodeId: string
): { step: TurnState; counters: Counters } {
  const counters =
    state.counters[nodeId] ||
    ({
      noMatch: 0,
      noInput: 0,
      notConfirmed: 0,
      confirmation: 0
    } as Counters);

  // Determina step basato su context e stato globale
  let step: TurnState = 'Start';

  if (state.context === 'CollectingSub' && state.currentSubId === nodeId) {
    step = state.turnState || 'Start';
  } else if (
    state.context === 'CollectingMain' &&
    state.currentMainId === nodeId
  ) {
    step = state.turnState || 'Start';
  }

  return { step, counters };
}

function requiresConfirmation(mainData: MainDataNode): boolean {
  // Controlla se il nodo ha uno step di confirmation
  return getStep(mainData, 'confirmation') !== null;
}

function isYes(input: string): boolean {
  const yesPatterns = ['sì', 'si', 'yes', 'ok', 'corretto', 'giusto', 'va bene', 'correct'];
  return yesPatterns.includes(input.toLowerCase().trim());
}

function isNo(input: string): boolean {
  const noPatterns = ['no', 'non', 'sbagliato', 'errato', 'correggi', 'wrong'];
  return noPatterns.includes(input.toLowerCase().trim());
}

async function playIntroduction(
  introduction: any,
  callbacks: DDTNavigatorCallbacks
): Promise<void> {
  if (introduction) {
    // Usa executeStep esistente per eseguire introduction
    await executeStep(introduction, callbacks, 'introduction', 0);
  }
}

// ============================================================================
// STEP HELPERS (compatibilità con struttura DDT esistente)
// ============================================================================

// Le funzioni getStep, getEscalationRecovery, executeStep sono importate da ddtSteps.ts
