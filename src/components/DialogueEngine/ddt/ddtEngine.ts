// DDT Engine - Nuova implementazione basata su logica proposta
// Implementazione parallela: NON tocca il codice esistente
// Permette test side-by-side e switch graduale

import type { AssembledTaskTree, dataNode } from '../../TaskTreeBuilder/DDTAssembler/currentDDT.types';
import type { DDTNavigatorCallbacks } from './ddtTypes';
import { getStep, getEscalationRecovery, executeStep } from './ddtSteps';
import { getTaskSemantics } from '../../../utils/taskSemantics';
import { getNodesWithFallback } from '../../../utils/taskTreeMigrationHelpers';

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
  data: dataNode;
  subData?: dataNode;
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
  ddtInstance: AssembledTaskTree,
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
    hasdata: !!ddtInstance.data,
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
  while (true) {
    // 1. Trova il prossimo dato da raccogliere
    const currData = getNextData(ddtInstance, state);

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
      timestamp: new Date().toISOString()
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
      const targetNode = currData.isMain ? currData.data : currData.subData!;
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
    const turnStateDesc = getState(
      currTurnEvent,
      currData,
      turnState,
      counters,
      limits,
      state,
      ddtInstance
    );

      // 8. Aggiorna stato globale
      state = updateState(state, turnStateDesc, currData);

      // Log solo per transizioni importanti
      if (turnStateDesc.turnState === 'Confirmation' || turnStateDesc.turnState === 'Success') {
        console.log('[DDTEngine] 🔄 State transition', {
          event: currTurnEvent,
          nextTurnState: turnStateDesc.turnState,
          memoryKeys: Object.keys(state.memory)
        });
      }

    // 9. Se siamo andati a Confirmation, continua ciclo per eseguire step Confirmation
    if (turnStateDesc.turnState === 'Confirmation') {
      console.log('[DDTEngine][runDDT] 🔄 Going to Confirmation, continuing loop');
      continue; // Continua ciclo per eseguire step Confirmation
    }

    // 10. Se siamo andati a Success, esegui step Success prima di terminare
    if (turnStateDesc.turnState === 'Success') {
      const targetNode = currData.isMain ? currData.data : currData.subData!;
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
  ddtInstance: AssembledTaskTree,
  state: DDTEngineState
): CurrentData | null {
  // ✅ Use helper with logging
  const dataList = getNodesWithFallback(ddtInstance, 'ddtEngine.getNextData');

  // ✅ Deduce semantics from structure
  const semantics = getTaskSemantics(ddtInstance);

  // ✅ For Collection: iterate over all data[] (each is independent)
  // ✅ For Atomic/CompositeData: iterate over data[0] and its subData
  for (const data of dataList) {
    // ✅ Runtime: use referenceId from instance (not recalculated from template)
    const dataId = (data as any).referenceId || data.id;
    const mainMemory = state.memory[dataId];
    const mainValue = mainMemory?.value;
    const isMainEmpty =
      !mainValue ||
      (typeof mainValue === 'object' &&
        Object.keys(mainValue).length === 0) ||
      mainValue === null ||
      mainValue === undefined;

    // Se data è vuoto, ritorna data
    if (isMainEmpty) {
      return {
        data,
        nodeId: dataId,
        isMain: true
      };
    }

    // Se data richiede confirmation, controlla se è confirmed
    if (requiresConfirmation(data)) {
      const isMainConfirmed = mainMemory?.confirmed === true;
      // Se non è confirmed, ritorna data (per confirmation)
      if (!isMainConfirmed) {
        return {
          data,
          nodeId: dataId,
          isMain: true
        };
      }
      // Se è confirmed, continua al prossimo data o controlla subData
    }

    // ✅ For Collection: skip subData check (Collection cannot have subData)
    if (semantics === 'Collection') {
      // Collection: all data[] are independent, continue to next data
      continue;
    }

    // ✅ For CompositeData: check if any subData is empty
    if (data.subData && Array.isArray(data.subData)) {
      const requiredSubs = data.subData.filter(
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
            data,
            subData,
            nodeId: subDataId,
            isMain: false
          };
        }
      }
    }

    // data e tutti i suoi sub sono pieni → continua al prossimo main
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
  const targetNode = currData.isMain ? currData.data : currData.subData!;

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
    const data = currData.data;

    // Se data ha subData, formatta tutti i valori
    if (data.subData && Array.isArray(data.subData) && data.subData.length > 0) {
      const values: string[] = [];
      for (const subData of data.subData) {
        const subValue = state.memory[subData.id]?.value;
        if (subValue !== undefined && subValue !== null) {
          values.push(String(subValue));
        }
      }
      inputValue = values.join(' ');
    } else {
      // data atomico
      const mainValue = state.memory[data.id]?.value;
      if (mainValue !== undefined && mainValue !== null) {
        inputValue = mainValue;
      }
    }
  }

  if (response.stepOrEscalation) {
    await executeStep(
      response.stepOrEscalation,
      callbacks,
      response.stepType,
      response.escalationLevel,
      inputValue
    );
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
  // 1. Attendi input utente
  if (!callbacks.onGetRetrieveEvent) {
    throw new Error('onGetRetrieveEvent callback not provided');
  }

  const nodeId = currData.nodeId;
  const node = currData.isMain ? currData.data : currData.subData!;

  // ✅ Carica contract come fa il vecchio engine (per mapping canonicalKey → subId)
  // Il contract DEVE essere caricato dall'originalNode nel DDT (come fa useNewFlowOrchestrator)
  let contract: any = null;

  try {
    const { loadContract } = await import('../../DialogueDataEngine/contracts/contractLoader');
    const { findOriginalNode } = await import('../../TaskEditor/ResponseEditor/ChatSimulator/messageResolvers');

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
  const userInputEvent = await callbacks.onGetRetrieveEvent(nodeId);
  const t1 = performance.now();
  console.log('[DDTEngine][processUserInput][PERF] onGetRetrieveEvent', { ms: Math.round(t1 - t0) });

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
        // Se data ha subData e il valore è un oggetto, decomponi e salva ogni subData
        // Il contract estrae valori con chiavi canonicalKey ("day", "month", "year")
        // Devo mappare canonicalKey → subData.id usando getSubIdForCanonicalKey (come fa il vecchio engine)
        if (currData.isMain && recognitionResult.value && typeof recognitionResult.value === 'object') {
          const data = currData.data;
          if (data.subData && Array.isArray(data.subData)) {
            // Log essenziale

            // ✅ USA LO STESSO METODO DEL VECCHIO ENGINE: getSubIdForCanonicalKey
            let mappedCount = 0;
            const { getSubIdForCanonicalKey } = await import('../../DialogueDataEngine/contracts/contractLoader');

            if (contract && contract.subDataMapping) {
              // Mappa canonicalKey → subId usando contract (come fa DialogueDataEngine/engine.ts riga 386)
              const tMap = performance.now();
              for (const [canonicalKey, value] of Object.entries(recognitionResult.value)) {
                const subId = getSubIdForCanonicalKey(contract, canonicalKey);
                if (subId) {
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
              for (const subData of data.subData) {
                const subValue = recognitionResult.value[subData.id] ||
                                recognitionResult.value[subData.label] ||
                                recognitionResult.value[subData.name];
                if (subValue !== undefined && subValue !== null) {
                  updateMemory(state, subData.id, subValue);
                  mappedCount++;
                }
              }
            }

            // Salva anche l'oggetto completo sotto data.id per riferimento
            updateMemory(state, currData.nodeId, recognitionResult.value);
          } else {
            // data atomico, salva direttamente
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
        const data = currData.data;
        if (data.subData && Array.isArray(data.subData)) {
          for (const subData of data.subData) {
            const subValue = recognitionResult.value[subData.id] ||
                            recognitionResult.value[subData.label] ||
                            recognitionResult.value[subData.name];
            if (subValue !== undefined && subValue !== null) {
              updateMemory(state, subData.id, subValue);
            }
          }
          updateMemory(state, currData.nodeId, recognitionResult.value);
        } else {
          updateMemory(state, currData.nodeId, recognitionResult.value);
        }
      } else {
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
        const data = currData.data;
        const missingSubs = findMissingRequiredSubs(data, state.memory);

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
          if (requiresConfirmation(data)) {
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
        const data = currData.data;

        // Controlla se data ha subData e se sono tutti pieni
        if (data.subData && data.subData.length > 0) {
          const missingSubs = findMissingRequiredSubs(data, state.memory);

          console.log('[DDTEngine] 🔍 Match: checking subData', {
            totalSubs: data.subData.length,
            missingCount: missingSubs.length,
            memoryKeys: Object.keys(state.memory),
            subDataCheck: data.subData.map(s => ({
              id: s.id.substring(0, 20) + '...',
              inMemory: !!state.memory[s.id],
              value: state.memory[s.id]?.value
            }))
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
            if (requiresConfirmation(data)) {
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
          // data atomico (senza sub) → confirmation o success
          if (requiresConfirmation(data)) {
            console.log('[DDTEngine] ✅ Atomic data → Confirmation');
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

function initializeState(ddtInstance: AssembledTaskTree): DDTEngineState {
  const state: DDTEngineState = {
    memory: {},
    counters: {},
    turnState: 'Start',
    context: 'CollectingMain'
  };

  // Normalizza data
  const dataList = Array.isArray(ddtInstance.data)
    ? ddtInstance.data
    : ddtInstance.data
    ? [ddtInstance.data]
    : [];

  // Inizializza counters per tutti i nodi
  for (const data of dataList) {
    state.counters[data.id] = {
      noMatch: 0,
      noInput: 0,
      notConfirmed: 0,
      confirmation: 0
    };

    if (data.subData && Array.isArray(data.subData)) {
      for (const subData of data.subData) {
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
  console.log('[DDTEngine] 💾 Saving to memory', { nodeId: nodeId.substring(0, 20) + '...', value });
  if (state.memory[nodeId]) {
    state.memory[nodeId].value = value;
  } else {
    state.memory[nodeId] = { value, confirmed: false };
  }
}

function markAsConfirmed(state: DDTEngineState, nodeId: string): void {
  if (state.memory[nodeId]) {
    state.memory[nodeId].confirmed = true;
  }
}

/**
 * Finds missing required subData for a data node
 * ✅ Uses referenceId from instance (not recalculated from template)
 * ✅ Handles CompositeData: checks all subData
 */
function findMissingRequiredSubs(
  data: dataNode,
  memory: Record<string, { value: any; confirmed: boolean }>
): dataNode[] {
  const missingSubs: dataNode[] = [];

  if (!data.subData || !Array.isArray(data.subData)) {
    return missingSubs;
  }

  for (const subData of data.subData) {
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
 * Checks if a data node is saturated
 * ✅ Uses referenceId from instance (not recalculated from template)
 */
function isdataSaturated(
  data: dataNode,
  memory: Record<string, { value: any; confirmed: boolean }>
): boolean {
  // ✅ Runtime: use referenceId from instance (not recalculated from template)
  const dataId = (data as any).referenceId || data.id;
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
  if (data.subData && Array.isArray(data.subData) && data.subData.length > 0) {
    return findMissingRequiredSubs(data, memory).length === 0;
  }

  return true;
}

function peekNextData(
  ddtInstance: AssembledTaskTree,
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
    state.currentMainId = currData.data.id;
    state.currentSubId = undefined;
  } else {
    state.currentMainId = currData.data.id;
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

function requiresConfirmation(data: dataNode): boolean {
  // Controlla se il nodo ha uno step di confirmation
  return getStep(data, 'confirmation') !== null;
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
