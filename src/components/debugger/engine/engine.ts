import { SimulatorState, ChatEvent } from './types';
import { parseInput } from './parser';
import { checkEscalation } from './escalation';
import { isDataSaturated } from './state';

/**
 * Advances the conversation by one step, handling parsing, escalation, subdata, and data saturation.
 * @param state Current simulator state
 * @param userInput User's input string
 * @param ddt Dialogue Data Template definition
 */
export async function advance(state: SimulatorState, userInput: string, ddt: any): Promise<SimulatorState> {
  const currentStep = ddt.steps[state.currentStepId];
  const expectedType = currentStep?.expectedType || 'text';

  // Parse input
  const parseResult = await parseInput(userInput, expectedType);

  // Escalation: noInput or noMatch
  const escalation = checkEscalation(userInput, parseResult);

  let newHistory = [...state.history];
  newHistory.push({
    from: 'user',
    stepId: state.currentStepId,
    text: userInput,
    type: 'input',
  });

  if (escalation) {
    newHistory.push({
      from: 'system',
      stepId: state.currentStepId,
      text: escalation,
      type: 'action',
    });
    return {
      ...state,
      history: newHistory,
      attempts: {
        ...state.attempts,
        [state.currentStepId]: (state.attempts[state.currentStepId] || 0) + 1,
      },
    };
  }

  // If missing subdata, trigger subdialogue
  if (parseResult.missingSubdata && parseResult.missingSubdata.length > 0) {
    const missing = parseResult.missingSubdata[0];
    newHistory.push({
      from: 'bot',
      stepId: state.currentStepId,
      text: `Please provide the ${missing}.`,
      type: 'message',
    });
    return {
      ...state,
      variables: { ...state.variables, ...parseResult.variables },
      history: newHistory,
    };
  }

  // If data is saturated, move to next step
  const allVars = { ...state.variables, ...parseResult.variables };
  if (isDataSaturated(allVars, expectedType)) {
    // Move to next step (simplified)
    const nextStepId = currentStep.nextStepId || '';
    newHistory.push({
      from: 'bot',
      stepId: nextStepId,
      text: ddt.steps[nextStepId]?.prompt || 'Done!',
      type: 'message',
    });
    return {
      ...state,
      currentStepId: nextStepId,
      variables: allVars,
      history: newHistory,
    };
  }

  // Default: update variables, stay on same step
  return {
    ...state,
    variables: allVars,
    history: newHistory,
  };
}