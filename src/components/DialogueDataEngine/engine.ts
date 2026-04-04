// DDT Engine V2 - Clean implementation following documentation
// Implements state machine logic as documented in documentation/DDT Engine.md

import type { DDTTemplateV2, DDTNode } from './model/ddt.v2.types';
import { buildPlan, isSaturated, nextMissingSub, setMemory, Memory, Plan } from './state';
import { isYes, isNo } from './utils';
import { getLogger } from './logger';
import { loadContract } from './contracts/contractLoader';
import { assertVbKeysMatchSubs } from './validation/vbExtractedKeys';

// Debug helpers for mixed-initiative tracing
function logMI(...args: any[]) {
  const logger = getLogger();
  if (!logger.miEnabled) return;
  try { logger.debug('[MixedInit]', ...args); } catch { }
}

// ============================================================================
// Node State - Internal state per ogni nodo (main o sub)
// ============================================================================

export type NodeStep = 'Start' | 'NoMatch' | 'NoInput' | 'Confirmation' | 'NotConfirmed' | 'Success';

export interface NodeState {
  step: NodeStep;
  counters: {
    noMatch: number;
    noInput: number;
    confirmation: number;
    notConfirmed: number;
  };
}

// ============================================================================
// Simulator State - Compatible with existing interface
// ============================================================================

export type Mode =
  | 'CollectingMain'
  | 'CollectingSub'
  | 'ConfirmingMain'
  | 'NotConfirmed'
  | 'SuccessMain'
  | 'Completed';

export interface SimulatorState {
  plan: Plan;
  mode: Mode; // External mode for compatibility
  currentIndex: number;
  currentSubId?: string;
  memory: Memory;
  transcript: Array<{ from: 'bot' | 'user'; text: string; meta?: any }>;
  counters: { notConfirmed: number }; // Legacy, kept for compatibility
  // New: internal node states
  nodeStates: Record<string, NodeState>;
  // Template originale per accedere ai contract
  template?: DDTTemplateV2;
  // Flag per indicare che il contract NLP è mancante
  grammarMissing?: boolean;
  grammarMissingNodeId?: string; // ID del nodo senza contract
}

// ============================================================================
// Helper Functions
// ============================================================================

function currentMain(state: SimulatorState): DDTNode | undefined {
  const mainId = state.plan.order[state.currentIndex];
  return state.plan.byId[mainId];
}

function getNodeState(state: SimulatorState, nodeId: string): NodeState {
  if (!state.nodeStates[nodeId]) {
    state.nodeStates[nodeId] = {
      step: 'Start',
      counters: { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 }
    };
  }
  return state.nodeStates[nodeId];
}

function setNodeState(state: SimulatorState, nodeId: string, updater: (ns: NodeState) => NodeState): SimulatorState {
  const current = getNodeState(state, nodeId);
  const updated = updater(current);
  return {
    ...state,
    nodeStates: { ...state.nodeStates, [nodeId]: updated }
  };
}

function requiredSubsOf(node: DDTNode, byId: Record<string, DDTNode>): string[] {
  const subs = (node.subs || []).filter((sid) => !!byId[sid]);
  return subs.filter((sid) => byId[sid].required !== false);
}

function nextMissingRequired(node: DDTNode, byId: Record<string, DDTNode>, memory: Memory): string | undefined {
  const subs = requiredSubsOf(node, byId);
  for (const sid of subs) {
    const m = memory[sid];
    if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return sid;
  }
  return undefined;
}

function isSaturatedRequired(node: DDTNode, byId: Record<string, DDTNode>, memory: Memory): boolean {
  const subs = requiredSubsOf(node, byId);
  if (subs.length === 0) return isSaturated(node, memory);
  for (const sid of subs) {
    const m = memory[sid];
    if (!m || m.value === undefined || m.value === null || String(m.value).length === 0) return false;
  }
  return true;
}

// ============================================================================
// Partial Confirmation Extraction
// ============================================================================

function extractPartialConfirmation(input: string): {
  isPartial: boolean;
  confirmedParts?: string[];
  correctedParts?: { [subId: string]: any };
} {
  // Pattern: "Sì, X è corretto ma Y è Z"
  const pattern1 = /(?:sì|ok|yes|corretto|va bene)[\s,]*([^,]+?)(?:è corretto|va bene|ok)[\s,]*ma[\s,]*([^,]+?)[\s,]*è[\s,]*([^\s,]+)/i;
  const m1 = pattern1.exec(input);
  if (m1) {
    // TODO: Parse confirmed and corrected parts
    // For now, return basic structure
    return { isPartial: true, confirmedParts: [], correctedParts: {} };
  }

  // Pattern: "X va bene, ma Y è Z"
  const pattern2 = /([^,]+?)(?:va bene|è corretto|ok)[\s,]*ma[\s,]*([^,]+?)[\s,]*è[\s,]*([^\s,]+)/i;
  const m2 = pattern2.exec(input);
  if (m2) {
    return { isPartial: true, confirmedParts: [], correctedParts: {} };
  }

  return { isPartial: false };
}

// ============================================================================
// State Mapping: Internal Node States → External Mode
// ============================================================================

function mapStateToMode(state: SimulatorState, main: DDTNode | undefined): Mode {
  if (!main) return 'Completed';

  const mainState = getNodeState(state, main.id);
  const currentSubId = state.currentSubId;

  // Map internal states to external modes
  // Context determinato da currentSubId, non da step
  switch (mainState.step) {
    case 'Start':
    case 'NoMatch':
    case 'NoInput':
      // Context determinato da currentSubId, non da step
      if (currentSubId) return 'CollectingSub';
      return 'CollectingMain';
    case 'Confirmation':
      return 'ConfirmingMain';
    case 'NotConfirmed':
      return 'NotConfirmed';
    case 'Success':
      return 'SuccessMain';
    default:
      return 'CollectingMain';
  }
}

// ============================================================================
// Advance Index (move to next main)
// ============================================================================

function advanceIndex(state: SimulatorState): SimulatorState {
  let nextIdx = state.currentIndex + 1;
  while (nextIdx < state.plan.order.length) {
    const nextId = state.plan.order[nextIdx];
    const nextNode = state.plan.byId[nextId];
    if (nextNode && nextNode.type === 'main') break;
    nextIdx += 1;
  }
  if (nextIdx >= state.plan.order.length) {
    return { ...state, mode: 'Completed', currentIndex: nextIdx };
  }

  const nextMain = state.plan.byId[state.plan.order[nextIdx]];
  let newState: SimulatorState = {
    ...state,
    currentIndex: nextIdx,
    currentSubId: undefined,
    mode: 'CollectingMain'
  };

  // Initialize node state for next main if not present
  if (!newState.nodeStates[nextMain.id]) {
    newState.nodeStates[nextMain.id] = {
      step: 'Start',
      counters: { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 }
    };
  }

  // If next main has subs and they are all present, compose its main value
  if (nextMain && Array.isArray((nextMain as any).subs) && (nextMain as any).subs.length > 0) {
    const allPresent = (nextMain as any).subs.every((sid: string) => {
      const m = state.memory[sid];
      return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
    });
    if (allPresent) {
      const composed: Record<string, any> = {};
      for (const sid of (nextMain as any).subs) {
        const m = state.memory[sid];
        if (m && m.value !== undefined) composed[sid] = m.value;
      }
      newState = { ...newState, memory: setMemory(state.memory, nextMain.id, composed, false) };
    }
  }

  // Check if next main has required subs missing
  if (nextMain && Array.isArray((nextMain as any).subs) && (nextMain as any).subs.length > 0) {
    const subsArr: string[] = (nextMain as any).subs.filter((sid: string) => !!newState.plan.byId[sid]);
    const anyPresent = subsArr.some((sid) => {
      const m = newState.memory[sid];
      return m && m.value !== undefined && m.value !== null && String(m.value).length > 0;
    });
    const missingSub = nextMissingRequired(nextMain as any, newState.plan.byId, newState.memory);
    if (missingSub && anyPresent) {
      logMI('advanceIndex', { nextIdx, nextMain: nextMain?.label, nextMode: 'CollectingSub', currentSubId: missingSub });
      return { ...newState, mode: 'CollectingSub', currentSubId: missingSub };
    }
  }

  const nextMode: Mode = (nextMain && isSaturatedRequired(nextMain as any, newState.plan.byId, newState.memory)) ? 'ConfirmingMain' : 'CollectingMain';
  logMI('advanceIndex', { nextIdx, nextMain: nextMain?.label, nextMode });
  return { ...newState, mode: nextMode };
}

// ============================================================================
// Main Advance Function
// ============================================================================

export function initEngine(template: DDTTemplateV2): SimulatorState {
  const plan = buildPlan(template.nodes);
  const nodeStates: Record<string, NodeState> = {};

  // Initialize node states for all nodes
  for (const node of template.nodes) {
    nodeStates[node.id] = {
      step: 'Start',
      counters: { noMatch: 0, noInput: 0, confirmation: 0, notConfirmed: 0 }
    };
  }

  const state = {
    plan,
    mode: 'CollectingMain',
    currentIndex: 0,
    memory: {},
    transcript: [],
    counters: { notConfirmed: 0 }, // Legacy
    nodeStates,
    template, // Store original template for contract access
    grammarMissing: false // Initialize grammar missing flag
  };

  // ✅ DEBUG: Log initialization
  const mainId = plan.order[0];
  const mainNode = mainId ? plan.byId[mainId] : undefined;
  console.log('[ENGINE] initEngine completed', {
    nodesCount: template.nodes.length,
    planOrderLength: plan.order.length,
    mainNodeId: mainId,
    mainNodeLabel: mainNode?.label,
    mainNodeKind: mainNode?.kind,
    mode: state.mode
  });

  return state;
}

export function advance(state: SimulatorState, input: string, extractedVariables?: Record<string, any>): SimulatorState {
  const main = currentMain(state);
  if (!main) {
    const finalState = { ...state, mode: 'Completed' };
    return finalState;
  }

  const trimmedInput = String(input || '').trim();

  // Handle empty input (noInput)
  if (trimmedInput.length === 0) {
    const newState = handleNoInput(state, main);
    return { ...newState, mode: mapStateToMode(newState, main) };
  }

  // Get current node state
  const mainState = getNodeState(state, main.id);
  const currentSubId = state.currentSubId;
  const sub = currentSubId ? state.plan.byId[currentSubId] : undefined;

  // Determine target node (main or sub)
  const targetNode = sub || main;
  const targetState = getNodeState(state, targetNode.id);

  let newState: SimulatorState = state;

  // Handle by current step - check mainState for Confirmation/NotConfirmed/Success
  if (mainState.step === 'Confirmation') {
    newState = handleConfirmation(state, main, trimmedInput);
  } else if (mainState.step === 'NotConfirmed') {
    newState = handleNotConfirmed(state, main, sub, trimmedInput, extractedVariables);
  } else if (mainState.step === 'Success') {
    // Move to next main
    newState = advanceIndex({ ...state, mode: 'CollectingMain' });
  } else if (targetState.step === 'Start' || targetState.step === 'NoMatch' || targetState.step === 'NoInput') {
    // Collecting data
    newState = handleCollecting(state, main, sub, trimmedInput, extractedVariables);
  }

  // Map internal states to external mode
  const updatedMain = currentMain(newState);
  newState = { ...newState, mode: mapStateToMode(newState, updatedMain) };

  return newState;
}

// ============================================================================
// Handle Collecting (Normal, ToComplete, NoMatch, NoInput)
// ============================================================================

function handleCollecting(
  state: SimulatorState,
  main: DDTNode,
  sub: DDTNode | undefined,
  input: string,
  extractedVariables?: Record<string, any>
): SimulatorState {
  // Determina il nodo in contesto (main o sub)
  const contextNode = sub || main;
  const contextType = sub ? 'collectingSub' : 'collectingMain';

  const mainState = getNodeState(state, main.id);
  const contextState = getNodeState(state, contextNode.id);

  // Se il nodo in contesto era in NoMatch/NoInput, torna a Start quando ricevi nuovo input
  if (contextState.step === 'NoMatch' || contextState.step === 'NoInput') {
    console.log('🔄 [ENGINE] Nodo in contesto era in NoMatch/NoInput, tornando a Start', {
      contextNodeId: contextNode.id,
      contextType,
      previousStep: contextState.step,
      newInput: input.substring(0, 50)
    });
    state = setNodeState(state, contextNode.id, (ns) => ({ ...ns, step: 'Start' }));
  }

  let mem = state.memory;
  let extracted: { memory: Memory; residual: string; hasMatch: boolean } | undefined = undefined;

  // VB-only: `extractedVariables` must be the normalized values map from /api/nlp/contract-extract (subId keys for composite).
  if (extractedVariables && typeof extractedVariables === 'object' && Object.keys(extractedVariables).length > 0) {
    logMI('extractedVariables', { extractedVariables, mainKind: main.kind });

    try {
      assertVbKeysMatchSubs(extractedVariables as Record<string, unknown>, main);
    } catch (e) {
      const isDevOrTest =
        import.meta.env.DEV === true ||
        import.meta.env.MODE === 'test' ||
        String(import.meta.env.MODE || '') === 'test';
      if (isDevOrTest) throw e;
      getLogger().error?.('[ENGINE] VB keys vs subs mismatch', { err: e, mainId: main.id });
      extracted = { memory: state.memory, residual: input, hasMatch: false };
    }

    if (!extracted) {
      if (Array.isArray(main.subs) && main.subs.length > 0) {
        for (const sid of main.subs) {
          const v = (extractedVariables as Record<string, unknown>)[sid];
          if (v !== undefined && v !== null) {
            mem = setMemory(mem, sid, v, false);
            logMI('memWriteFromExtracted', { sid, value: v });
          }
        }

        const composeFromSubs = (m: DDTNode, memory: Memory) => {
          if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
          const out: Record<string, any> = {};
          for (const s of (m.subs || [])) {
            const v = memory[s]?.value;
            if (v !== undefined) out[s] = v;
          }
          return out;
        };
        mem = setMemory(mem, main.id, composeFromSubs(main, mem), false);
        state = { ...state, memory: mem };
      } else {
        const raw = extractedVariables as Record<string, unknown>;
        const value = raw.value !== undefined ? raw.value : raw[main.id];
        if (value !== undefined && value !== null) {
          mem = setMemory(state.memory, main.id, value, false);
          state = { ...state, memory: mem };
        }
      }
      mem = state.memory;
      extracted = { memory: mem, residual: input, hasMatch: true };
      logMI('extractedFromVariables', { hasMatch: true, memoryKeys: Object.keys(mem) });
    }
  } else {
    mem = state.memory;
    extracted = { memory: mem, residual: input, hasMatch: false };
  }

  // Separate concepts: matchOccurred vs memoryChanged
  // matchOccurred: grammar recognized something (even if value already present)
  // memoryChanged: memory actually changed (new value or different value)

  // Check if a match occurred (grammar recognized something)
  // This is separate from memoryChanged: a match can occur even if memory doesn't change
  // (e.g., user says "dicembre" when month=12 already in memory)
  const matchOccurred = extracted?.hasMatch === true;

  // Check if memory changed (deep comparison)
  let memoryChanged = false;
  const oldKeys = Object.keys(state.memory);
  const newKeys = Object.keys(mem);
  if (newKeys.length !== oldKeys.length) {
    memoryChanged = true;
  } else {
    // Check if existing values changed or new values added
    for (const key of newKeys) {
      const newVal = mem[key];
      const oldVal = state.memory[key];

      // New key added
      if (!oldVal) {
        memoryChanged = true;
        break;
      }

      // Value changed
      if (typeof newVal.value === 'object' && newVal.value !== null && typeof oldVal.value === 'object' && oldVal.value !== null) {
        // Deep comparison for objects
        try {
          if (JSON.stringify(newVal.value) !== JSON.stringify(oldVal.value)) {
            memoryChanged = true;
            break;
          }
        } catch {
          // If JSON.stringify fails, compare by reference
          if (newVal.value !== oldVal.value) {
            memoryChanged = true;
            break;
          }
        }
      } else if (newVal.value !== oldVal.value) {
        memoryChanged = true;
        break;
      }

      // Confirmed flag changed
      if (newVal.confirmed !== oldVal.confirmed) {
        memoryChanged = true;
        break;
      }
    }
  }

  // Logging mirato per debug
  logMI('matchCheck', {
    hasExtracted: !!extracted,
    extractedHasMatch: extracted?.hasMatch,
    matchOccurred,
    memoryChanged,
    currentSubId: state.currentSubId,
    mainId: main.id,
    subId: sub?.id
  });

  // Use matchOccurred to determine if we should go to noMatch
  // NOT memoryChanged (which can be false even if match occurred)
  if (!matchOccurred) {
    // NoMatch totale → incrementa contatore sul nodo in contesto (main o sub)
    console.log('🚨 [ENGINE] NoMatch totale rilevato', {
      contextType,
      contextNodeId: contextNode.id,
      contextNodeLabel: contextNode.label,
      mainId: main.id,
      mainLabel: main.label,
      subId: sub?.id,
      subLabel: sub?.label,
      extractedHasMatch: extracted?.hasMatch,
      memoryChanged,
      matchOccurred,
      input: input.substring(0, 50)
    });

    logMI('noMatchTotal', {
      contextType,
      contextNodeId: contextNode.id,
      mainId: main.id,
      currentSubId: state.currentSubId,
      reason: 'NoMatch totale: nessuna grammatica ha riconosciuto nulla'
    });

    // Verifica se il contract è mancante
    const originalNode = state.template?.nodes.find(n => n.id === main.id);
    const contract = originalNode ? loadContract(originalNode) : null;
    const isGrammarMissing = !contract || (contract && contract.templateName !== main.kind);

    // Composite main + collecting a sub: total no-match is attributed to the main (tests / escalation UX)
    const noMatchTargetNode =
      sub && Array.isArray(main.subs) && main.subs.length > 0 ? main : contextNode;
    const noMatchState = handleNoMatch(state, noMatchTargetNode);

    // Aggiungi flag grammarMissing se il contract non è disponibile
    const finalState = isGrammarMissing
      ? { ...noMatchState, grammarMissing: true, grammarMissingNodeId: main.id }
      : { ...noMatchState, grammarMissing: false };

    // Preserva currentSubId se eravamo in collectingSub
    const preservedState = state.currentSubId
      ? { ...finalState, currentSubId: state.currentSubId }
      : finalState;

    return { ...preservedState, mode: mapStateToMode(preservedState, main) };
  }

  // Match occurred → update memory and check saturation
  state = { ...state, memory: mem };

  // Handle sub collection
  if (sub) {
    // Recompose main value from current sub values
    const composeFromSubs = (m: DDTNode, memory: Memory) => {
      if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
      const out: Record<string, any> = {};
      for (const s of (m.subs || [])) {
        const v = memory[s]?.value;
        if (v !== undefined) out[s] = v;
      }
      return out;
    };
    state = { ...state, memory: setMemory(state.memory, main.id, composeFromSubs(main, state.memory), false) };

    // Check if the active sub matched (per distinguere match utile da irrilevante)
    const activeSubMatched = mem[sub.id]?.value !== undefined &&
      mem[sub.id]?.value !== state.memory[sub.id]?.value;

    // Find next missing required sub
    const requiredIds = (main.subs || []).filter((s) => !!state.plan.byId[s] && state.plan.byId[s].required !== false);

    // Find next missing required sub (follow structural order)
    const nextRequiredMissing = requiredIds.find((s) => {
      const m = mem[s];  // Usa memoria aggiornata (mem) invece di state.memory
      return !m || m.value === undefined || m.value === null || String(m.value).length === 0;
    });

    if (nextRequiredMissing) {
      // More subs to collect
      // Match irrilevante: se il sub attivo non ha matchato, rimani su quello stesso
      if (nextRequiredMissing === sub.id && !activeSubMatched) {
        // Match irrilevante → non cambia step, ripete prompt stesso context
        // Rimani in Start (non ToComplete) con lo stesso sub
        return setNodeState(
          { ...state, currentSubId: sub.id },
          main.id,
          (ns) => ({ ...ns, step: 'Start' })
        );
      }
      // Match utile → passa al prossimo sub mancante (o stesso se era quello)
      return setNodeState(
        { ...state, currentSubId: nextRequiredMissing },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
    }

    // All subs filled → go to confirmation
    const confirmState = setNodeState(
      { ...state, currentSubId: undefined },
      main.id,
      (ns) => ({ ...ns, step: 'Confirmation' })
    );
    return { ...confirmState, mode: mapStateToMode(confirmState, main) };
  }

  // Handle main collection
  // First, recompose main value from subs if needed
  if (Array.isArray(main.subs) && main.subs.length > 0) {
    const composeFromSubs = (m: DDTNode, memory: Memory) => {
      if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
      const out: Record<string, any> = {};
      for (const s of (m.subs || [])) {
        const v = memory[s]?.value;
        if (v !== undefined) out[s] = v;
      }
      return out;
    };
    state = { ...state, memory: setMemory(state.memory, main.id, composeFromSubs(main, state.memory), false) };
  }

  const missing = nextMissingRequired(main, state.plan.byId, state.memory);
  const saturated = isSaturatedRequired(main, state.plan.byId, state.memory);

  if (saturated && !missing) {
    // All filled → check if confirmation step exists
    const hasConfirmation = main.steps?.confirm && (
      (typeof main.steps.confirm === 'object' && main.steps.confirm.base) ||
      (Array.isArray(main.steps.confirm) && main.steps.confirm.length > 0)
    );

    if (hasConfirmation) {
      // Confirmation step exists → go to Confirmation
      const confirmState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Confirmation' }));
      return { ...confirmState, mode: mapStateToMode(confirmState, main) };
    } else {
      // No confirmation step → go directly to Success
      const successState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Success' }));
      return { ...successState, mode: mapStateToMode(successState, main) };
    }
  }

  if (missing) {
    // Some subs missing → passa al primo sub mancante, step = Start
    const startState = setNodeState(
      { ...state, currentSubId: missing },
      main.id,
      (ns) => ({ ...ns, step: 'Start' })
    );
    return { ...startState, mode: mapStateToMode(startState, main) };
  }

  // Still collecting main → stay in Start
  const startState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Start' }));
  return { ...startState, mode: mapStateToMode(startState, main) };
}

// ============================================================================
// Handle NoMatch
// ============================================================================

function handleNoMatch(state: SimulatorState, node: DDTNode): SimulatorState {
  const nodeState = getNodeState(state, node.id);
  const nextCounter = Math.min(3, nodeState.counters.noMatch + 1);
  const main = currentMain(state);

  // Set step to NoMatch and increment counter
  // DO NOT return to Start immediately - let the UI show the escalation message
  // The step will return to Start when the user provides a new input (handled in handleCollecting)
  const newState = setNodeState(
    state,
    node.id,
    (ns) => ({
      ...ns,
      step: 'NoMatch',
      counters: { ...ns.counters, noMatch: nextCounter }
    })
  );

  console.log('🚨 [ENGINE] handleNoMatch completato', {
    nodeId: node.id,
    nodeLabel: node.label,
    step: 'NoMatch',
    counter: nextCounter,
    note: 'Step rimane NoMatch per permettere alla UI di mostrare escalation'
  });

  return newState;
}

// ============================================================================
// Handle NoInput
// ============================================================================

function handleNoInput(state: SimulatorState, main: DDTNode): SimulatorState {
  const currentSubId = state.currentSubId;
  const targetNode = currentSubId ? state.plan.byId[currentSubId] : main;
  if (!targetNode) return state;

  const nodeState = getNodeState(state, targetNode.id);
  const nextCounter = Math.min(3, nodeState.counters.noInput + 1);

  const newState = setNodeState(
    state,
    targetNode.id,
    (ns) => ({
      ...ns,
      step: 'NoInput',
      counters: { ...ns.counters, noInput: nextCounter }
    })
  );

  // DO NOT return to Start immediately - let the UI show the escalation message
  // The step will return to Start when the user provides a new input (handled in handleCollecting)
  return newState;
}

// ============================================================================
// Handle Confirmation
// ============================================================================

function handleConfirmation(state: SimulatorState, main: DDTNode, input: string): SimulatorState {
  if (isYes(input)) {
    // Confirmed → mark as confirmed and go to Success
    const mem = setMemory(state.memory, main.id, state.memory[main.id]?.value, true);
    const successState = setNodeState(
      { ...state, memory: mem },
      main.id,
      (ns) => ({ ...ns, step: 'Success' })
    );
    return { ...successState, mode: mapStateToMode(successState, main) };
  }

  if (isNo(input)) {
    // Not confirmed → go to NotConfirmed
    const nodeState = getNodeState(state, main.id);
    const nextCounter = Math.min(3, nodeState.counters.notConfirmed + 1);
    const notConfirmedState = setNodeState(
      state,
      main.id,
      (ns) => ({
        ...ns,
        step: 'NotConfirmed',
        counters: { ...ns.counters, notConfirmed: nextCounter }
      })
    );
    return { ...notConfirmedState, mode: mapStateToMode(notConfirmedState, main) };
  }

  // Check for partial confirmation
  const partial = extractPartialConfirmation(input);
  if (partial.isPartial && partial.correctedParts) {
    // Apply corrections
    let mem = state.memory;
    for (const [subId, value] of Object.entries(partial.correctedParts)) {
      mem = setMemory(mem, subId, value, false);
    }
    // Recompose main
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      const composeFromSubs = (m: DDTNode, memory: Memory) => {
        if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
        const out: Record<string, any> = {};
        for (const s of (m.subs || [])) {
          const v = memory[s]?.value;
          if (v !== undefined) out[s] = v;
        }
        return out;
      };
      mem = setMemory(mem, main.id, composeFromSubs(main, mem), false);
    }
    // Find corrected sub and go back to collecting it
    const correctedSubId = Object.keys(partial.correctedParts)[0];
    if (correctedSubId && main.subs?.includes(correctedSubId)) {
      const startState = setNodeState(
        { ...state, memory: mem, currentSubId: correctedSubId },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    } else {
      const startState = setNodeState(
        { ...state, memory: mem },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    }
  }

  // Unknown input in confirmation → stay in Confirmation
  return { ...state, mode: mapStateToMode(state, main) };
}

// ============================================================================
// Handle NotConfirmed
// ============================================================================

function handleNotConfirmed(
  state: SimulatorState,
  main: DDTNode,
  sub: DDTNode | undefined,
  input: string,
  extractedVariables?: Record<string, any>
): SimulatorState {
  const trimmed = String(input || '').trim();
  const chooseM = trimmed.match(/^choose:\s*(\w+)/i);
  if (chooseM && main.subs?.includes(chooseM[1])) {
    const sid = chooseM[1];
    const startState = setNodeState(
      { ...state, currentSubId: sid },
      main.id,
      (ns) => ({ ...ns, step: 'Start' })
    );
    return { ...startState, mode: mapStateToMode(startState, main) };
  }

  let mem = state.memory;
  let hasMatch = false;

  if (extractedVariables && typeof extractedVariables === 'object' && Object.keys(extractedVariables).length > 0) {
    let mergeOk = true;
    try {
      assertVbKeysMatchSubs(extractedVariables as Record<string, unknown>, main);
    } catch (e) {
      mergeOk = false;
      const isDevOrTest =
        import.meta.env.DEV === true ||
        import.meta.env.MODE === 'test' ||
        String(import.meta.env.MODE || '') === 'test';
      if (isDevOrTest) throw e;
      getLogger().error?.('[ENGINE] NotConfirmed: VB keys vs subs mismatch', { err: e, mainId: main.id });
    }

    if (mergeOk) {
      if (Array.isArray(main.subs) && main.subs.length > 0) {
        for (const sid of main.subs) {
          const v = (extractedVariables as Record<string, unknown>)[sid];
          if (v !== undefined && v !== null) {
            mem = setMemory(mem, sid, v, false);
            hasMatch = true;
          }
        }
      } else {
        const raw = extractedVariables as Record<string, unknown>;
        const value = raw.value !== undefined ? raw.value : raw[main.id];
        if (value !== undefined && value !== null) {
          mem = setMemory(mem, main.id, value, false);
          hasMatch = true;
        }
      }
    }
  }

  if (hasMatch) {
    // Correction provided → go back to Normal
    // Recompose main if needed
    if (Array.isArray(main.subs) && main.subs.length > 0) {
      const composeFromSubs = (m: DDTNode, memory: Memory) => {
        if (!Array.isArray(m.subs) || m.subs.length === 0) return memory[m.id]?.value;
        const out: Record<string, any> = {};
        for (const s of (m.subs || [])) {
          const v = memory[s]?.value;
          if (v !== undefined) out[s] = v;
        }
        return out;
      };
      mem = setMemory(mem, main.id, composeFromSubs(main, mem), false);
    }

    // Find which sub was corrected (if any)
    const missing = nextMissingRequired(main, state.plan.byId, mem);
    if (missing) {
      const startState = setNodeState(
        { ...state, memory: mem, currentSubId: missing },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    } else {
      const startState = setNodeState(
        { ...state, memory: mem },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
      return { ...startState, mode: mapStateToMode(startState, main) };
    }
  }

  // No match → increment counter; after 3, force collecting the first missing sub
  const nodeState = getNodeState(state, main.id);
  const nextCounter = Math.min(3, nodeState.counters.notConfirmed + 1);
  if (nextCounter >= 3) {
    const missing = nextMissingRequired(main, state.plan.byId, state.memory);
    const saturated = isSaturatedRequired(main, state.plan.byId, state.memory);
    if (saturated && !missing) {
      const confirmState = setNodeState(state, main.id, (ns) => ({ ...ns, step: 'Confirmation' }));
      return { ...confirmState, mode: mapStateToMode(confirmState, main) };
    }
    const lifted = setNodeState(
      state,
      main.id,
      (ns) => ({
        ...ns,
        step: 'Start',
        counters: { ...ns.counters, notConfirmed: nextCounter }
      })
    );
    const withSub = { ...lifted, currentSubId: missing };
    return { ...withSub, mode: mapStateToMode(withSub, main) };
  }
  const notConfirmedState = setNodeState(
    state,
    main.id,
    (ns) => ({
      ...ns,
      counters: { ...ns.counters, notConfirmed: nextCounter }
    })
  );
  return { ...notConfirmedState, mode: mapStateToMode(notConfirmedState, main) };
}
