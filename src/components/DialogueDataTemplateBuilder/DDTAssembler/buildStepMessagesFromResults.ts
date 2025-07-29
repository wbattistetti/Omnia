// buildStepMessagesFromResults: maps AI stepResults to a robust stepMessages object for DDT assembly.
export type StepResults = Array<{ stepKey: string; payload: any }>;
export type StepMessages = Record<string, string[][]>;

export function buildStepMessagesFromResults(stepResults: StepResults): StepMessages {
  const stepKeyMap: Record<string, string> = {
    startPrompt: 'start',
    noMatchPrompts: 'noMatch',
    noInputPrompts: 'noInput',
    confirmationPrompts: 'confirmation',
    successPrompts: 'success',
    // Add more mappings as needed
  };
  const stepMessages: StepMessages = {};
  for (const result of stepResults) {
    const mappedStep = stepKeyMap[result.stepKey];
    if (!mappedStep) continue;
    let messages: string[] = [];
    if (Array.isArray(result.payload)) {
      messages = result.payload;
    } else if (result.payload && Array.isArray(result.payload.ai)) {
      messages = result.payload.ai;
    } else if (result.payload && typeof result.payload === 'object') {
      if (Array.isArray(result.payload.messages)) {
        messages = result.payload.messages;
      } else if (typeof result.payload.message === 'string') {
        messages = [result.payload.message];
      }
    }
    if (!Array.isArray(messages) || messages.length === 0) continue;
    if (!stepMessages[mappedStep]) stepMessages[mappedStep] = [];
    stepMessages[mappedStep].push(messages);
  }
  return stepMessages;
}