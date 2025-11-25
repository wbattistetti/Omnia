// DDT Retrieve Logic - Main retrieval function with event loop

import type { DDTState, RetrieveResult, RetrieveEvent, DDTNavigatorCallbacks } from './ddtTypes';
import { saveToMemory } from './ddtMemory';
import { getNoMatchStep, getNoInputStep, getStep, getEscalationRecovery, executeStep, hasExitAction } from './ddtSteps';
import { getRetrieveEvent, handleExitAction } from './ddtEvents';

/**
 * Main retrieve function for a DDT node (main or sub)
 * Implements the linear logic: Normal → Loop → Events → Escalation
 */
export async function retrieve(
  node: any,
  state: DDTState,
  callbacks: DDTNavigatorCallbacks
): Promise<RetrieveResult> {
  const nodeId = node.id;

  // Ensure node has id
  if (!nodeId) {
    nodeId = node.id || node._id || `node_${Date.now()}`;
    node.id = nodeId;
  }

  console.log('[DDTRetrieve] 🔧 OLD ENGINE: Starting retrieve for node', {
    nodeId,
    nodeLabel: node.label || node.name,
    hasSteps: !!node.steps,
    stepsType: Array.isArray(node.steps) ? 'array' : typeof node.steps,
    stepsTypes: node.steps ? (Array.isArray(node.steps) ? node.steps.map((s: any) => s.type) : [node.steps.type]) : [],
    nodeKeys: Object.keys(node),
    timestamp: new Date().toISOString()
  });

  // Initialize counters for this node if not present
  let noMatchCounter = state.noMatchCounters[nodeId] || 0;
  let noInputCounter = state.noInputCounters[nodeId] || 0;
  let notConfirmedCounter = state.notConfirmedCounters[nodeId] || 0;

  // 1. Execute Step.start (or 'Normal' if exists) initially
  const startStep = getStep(node, 'start') || getStep(node, 'Normal');
  console.log('[DDTRetrieve] Start step', {
    found: !!startStep,
    stepType: startStep?.type,
    hasEscalations: !!startStep?.escalations,
    escalationsCount: startStep?.escalations ? (Array.isArray(startStep.escalations) ? startStep.escalations.length : 1) : 0,
    nodeId,
    nodeLabel: node?.label || node?.name,
    nodeSteps: node.steps ? (Array.isArray(node.steps) ? node.steps.map((s: any) => s.type) : Object.keys(node.steps)) : [],
    hasOnMessage: !!callbacks.onMessage,
    hasTranslations: !!callbacks.translations,
    translationsCount: callbacks.translations ? Object.keys(callbacks.translations).length : 0
  });

  if (startStep) {
    console.log('[DDTRetrieve] ═══════════════════════════════════════════════');
    console.log('[DDTRetrieve] EXECUTING START STEP - This should show initial message');
    console.log('[DDTRetrieve] ═══════════════════════════════════════════════');
    await executeStep(startStep, callbacks, 'start', 1);
    console.log('[DDTRetrieve] ═══════════════════════════════════════════════');
    console.log('[DDTRetrieve] START STEP EXECUTED - Initial message should have been shown');
    console.log('[DDTRetrieve] ═══════════════════════════════════════════════');
  } else {
    console.warn('[DDTRetrieve] ❌ No start step found for node', nodeId);
  }

  // 2. Main loop: wait for events and handle escalation
  while (true) {
    console.log('[DDTRetrieve] Waiting for retrieve event', { nodeId });

    // Get event (noMatch, noInput, match, etc.)
    // This will wait for user input via onGetRetrieveEvent callback
    // Pass DDT from callbacks (set by ddtNavigator) so it can find the DDT structure
    let event = await getRetrieveEvent(nodeId, callbacks.onGetRetrieveEvent, (callbacks as any).ddt);

    console.log('[DDTRetrieve] Received event', {
      nodeId,
      eventType: event.type,
      hasValue: !!event.value
    });

    // If event is match (raw input), process it to determine actual status
    if (event.type === 'match' && callbacks.onProcessInput && event.value) {
      console.log('[DDTRetrieve] Processing input', { nodeId, rawInput: event.value, hasNode: !!node });
      const rawInput = event.value; // Raw input string
      const processResult = await callbacks.onProcessInput(rawInput, node);

      console.log('[DDTRetrieve] Input processing result', {
        nodeId,
        rawInput,
        status: processResult.status,
        hasValue: !!processResult.value
      });

      // Update event based on processing result
      // Notify callback about user input processing result
      if (callbacks.onUserInputProcessed) {
        const matchStatus = processResult.status === 'partialMatch' ? 'match' : processResult.status;
        // Convert extracted value to ExtractedValue[] format
        let extractedValues: any[] | undefined = undefined;
        if (processResult.value && typeof processResult.value === 'object') {
          extractedValues = Object.entries(processResult.value).map(([key, val]) => ({
            variable: key,
            linguisticValue: undefined, // Will be filled by useNewFlowOrchestrator
            semanticValue: val
          }));
        }
        callbacks.onUserInputProcessed(rawInput, matchStatus as 'match' | 'noMatch' | 'partialMatch', extractedValues);
      }

      if (processResult.status === 'match') {
        event = { type: 'match' as const, value: processResult.value };
      } else if (processResult.status === 'noMatch') {
        console.log('[DDTRetrieve] Input did not match - converting to noMatch event', { nodeId, rawInput });
        event = { type: 'noMatch' as const };
      } else if (processResult.status === 'partialMatch') {
        // Partial match: treat as match but may need more info
        event = { type: 'match' as const, value: processResult.value };
      } else {
        console.log('[DDTRetrieve] Unknown processing status - converting to noMatch', { nodeId, rawInput, status: processResult.status });
        event = { type: 'noMatch' as const };
      }
    }

    switch (event.type) {
      case 'noMatch':
        noMatchCounter++;
        console.log('[DDTRetrieve] Handling noMatch event', {
          nodeId,
          noMatchCounter,
          nodeSteps: node.steps ? (Array.isArray(node.steps) ? node.steps.map((s: any) => s.type) : Object.keys(node.steps)) : []
        });

        // Get escalation recovery
        const noMatchStepType = getNoMatchStep(noMatchCounter);
        const noMatchStep = getStep(node, noMatchStepType);
        console.log('[DDTRetrieve] Found noMatch step', {
          stepType: noMatchStepType,
          found: !!noMatchStep,
          hasEscalations: !!noMatchStep?.escalations,
          escalationsCount: noMatchStep?.escalations ? (Array.isArray(noMatchStep.escalations) ? noMatchStep.escalations.length : 1) : 0
        });

        const noMatchRecovery = noMatchStep
          ? getEscalationRecovery(noMatchStep, 'noMatch', noMatchCounter)
          : null;

        console.log('[DDTRetrieve] Found noMatch recovery', {
          found: !!noMatchRecovery,
          level: noMatchCounter,
          hasActions: !!noMatchRecovery?.actions,
          actionsCount: noMatchRecovery?.actions ? (Array.isArray(noMatchRecovery.actions) ? noMatchRecovery.actions.length : 1) : 0
        });

        // Fallback: if no recovery, use Normal step
        if (!noMatchRecovery) {
          console.log('[DDTRetrieve] No recovery found, using Normal step as fallback');
          const normalStep = getStep(node, 'Normal') || getStep(node, 'start');
          if (normalStep) {
            await executeStep(normalStep, callbacks, 'start', 1);
            console.log('[DDTRetrieve] Normal step executed as fallback, continuing loop');
            break;
          } else {
            console.error('[DDTRetrieve] No NoMatch recovery and no Normal step available', {
              nodeId,
              level: noMatchCounter,
              hasNoMatchStep: !!noMatchStep
            });
            return {
              success: false,
              error: new Error(`No NoMatch recovery available for node ${nodeId} at level ${noMatchCounter}`)
            };
          }
        }

        // Check for exit action in last recovery
        if (hasExitAction(noMatchRecovery)) {
          console.log('[DDTRetrieve] NoMatch recovery has exit action');
          return handleExitAction(noMatchRecovery.actions.find((a: any) =>
            a.type === 'Exit' || a.exitAction === true
          ));
        }

        // Execute recovery
        console.log('[DDTRetrieve] Executing noMatch recovery', {
          nodeId,
          level: noMatchCounter,
          hasOnMessage: !!callbacks.onMessage
        });
        await executeStep(noMatchRecovery, callbacks, 'noMatch', noMatchCounter);
        console.log('[DDTRetrieve] NoMatch recovery executed, continuing loop');
        break;

      case 'noInput':
        noInputCounter++;

        const noInputStep = getStep(node, getNoInputStep(noInputCounter));
        const noInputRecovery = noInputStep
          ? getEscalationRecovery(noInputStep, 'noInput', noInputCounter)
          : null;

        if (!noInputRecovery) {
          return {
            success: false,
            error: new Error(`No NoInput recovery available for node ${nodeId} at level ${noInputCounter}`)
          };
        }

        if (hasExitAction(noInputRecovery)) {
          return handleExitAction(noInputRecovery.actions.find((a: any) =>
            a.type === 'Exit' || a.exitAction === true
          ));
        }

        await executeStep(noInputRecovery, callbacks, 'noInput', noInputCounter);
        break;

      case 'match':
        // Save value to memory (value is already processed by onProcessInput)
        const matchValue = event.value;
        const newState = saveToMemory(state, nodeId, matchValue, false);
        state = newState;

        // Check if confirmation step exists
        const confirmStep = getStep(node, 'confirmation') || getStep(node, 'Confirm');

        if (confirmStep) {
          // Execute confirmation step - pass matchValue to replace {input} placeholder
          await executeStep(confirmStep, callbacks, 'confirmation', 1, matchValue);

          // Wait for confirmation event
          const confirmEvent = await getRetrieveEvent(nodeId, callbacks.onGetRetrieveEvent, node);

          if (confirmEvent.type === 'notConfirmed') {
            notConfirmedCounter++;

            const notConfirmedStep = getStep(node, 'notConfirmed') || getStep(node, 'NotConfirmed');
            const notConfirmedRecovery = notConfirmedStep
              ? getEscalationRecovery(notConfirmedStep, 'notConfirmed', notConfirmedCounter)
              : null;

            if (notConfirmedRecovery) {
              await executeStep(notConfirmedRecovery, callbacks, 'notConfirmed', notConfirmedCounter);
              // Continue loop to re-ask
              continue;
            } else {
              // No recovery: restart from beginning
              return await retrieve(node, state, callbacks);
            }
          } else if (confirmEvent.type === 'confirmed') {
            // Confirmed: mark as confirmed and exit
            state = saveToMemory(state, nodeId, event.value, true);

            // Execute success step if exists
            const successStep = getStep(node, 'Success');
            if (successStep) {
              await executeStep(successStep, callbacks, 'success', 1);
            }

            return { success: true, value: event.value };
          }
        } else {
          // No confirmation: save and exit directly
          const successStep = getStep(node, 'Success');
          if (successStep) {
            await executeStep(successStep, callbacks, 'success', 1);
          }

          return { success: true, value: event.value };
        }
        // Note: break is not needed here - both branches above return

      case 'exit':
        return handleExitAction(event.exitAction);

      default:
        // Unknown event type
        return {
          success: false,
          error: new Error(`Unknown event type: ${(event as any).type}`)
        };
    }

    // Update counters in state
    state.noMatchCounters[nodeId] = noMatchCounter;
    state.noInputCounters[nodeId] = noInputCounter;
    state.notConfirmedCounters[nodeId] = notConfirmedCounter;
  }
}

