// buildStepMessagesFromResults: maps AI stepResults to a robust stepMessages object for DDT assembly.
export type StepResults = Array<{ stepKey: string; payload: any }>;
export type StepMessages = Record<string, string[][]>;

// Nuovo tipo per stepMessages con supporto subData
export interface SubDataStepMessages {
  mainData: StepMessages;
  subData: Record<string, StepMessages>; // key: subData name, value: stepMessages
}

export function buildSteps(stepResults: StepResults): StepMessages {
  return buildStepsWithSubData(stepResults).mainData;
}

export function buildStepsWithSubData(stepResults: StepResults): SubDataStepMessages {
  const stepKeyMap: Record<string, string> = {
    startPrompt: 'start',
    noMatchPrompts: 'noMatch',
    noInputPrompts: 'noInput',
    confirmationPrompts: 'confirmation',
    notConfirmedPrompts: 'notConfirmed',
    successPrompts: 'success',
    // Add more mappings as needed
  };

  const mainDataStepMessages: StepMessages = {};
  const subDataStepMessages: Record<string, StepMessages> = {};

  for (const result of stepResults) {
    // Check if this is a subData step
    if (result.stepKey.startsWith('subData_')) {
      // Extract subData name from stepKey (format: subData_startPrompt_Day_0)
      const stepTypeMatch = result.stepKey.match(/subData_(.+?)_(.+?)_(\d+)/);
      if (stepTypeMatch) {
        const stepType = stepTypeMatch[1]; // startPrompt, noMatchPrompts, etc.
        const subDataName = stepTypeMatch[2].toLowerCase(); // Day -> day
        const index = stepTypeMatch[3];
        
        if (!subDataStepMessages[subDataName]) {
          subDataStepMessages[subDataName] = {};
        }
        
        // Use extractMessages like mainData
        const messages = extractMessages(result.payload);
        if (Array.isArray(messages) && messages.length > 0) {
          // Map stepType to the correct key (e.g., startPrompt -> start)
          const mappedStepType = stepKeyMap[stepType];
          // For subData we explicitly skip confirmation/success groups
          if (mappedStepType && mappedStepType !== 'confirmation' && mappedStepType !== 'success') {
            if (!subDataStepMessages[subDataName][mappedStepType]) {
              subDataStepMessages[subDataName][mappedStepType] = [];
            }
            // Add each message in its own array (same format as mainData)
            for (const msg of messages) {
              subDataStepMessages[subDataName][mappedStepType].push([msg]);
            }
          }
        }
      }
    } else {
      // Handle mainData steps
      const mappedStep = stepKeyMap[result.stepKey];
      if (!mappedStep) continue;
      
      const messages = extractMessages(result.payload);
      if (!Array.isArray(messages) || messages.length === 0) continue;
      
      if (!mainDataStepMessages[mappedStep]) mainDataStepMessages[mappedStep] = [];
      // PATCH: ogni messaggio in un array singolo
      for (const msg of messages) {
        mainDataStepMessages[mappedStep].push([msg]);
      }
    }
  }
  
  return {
    mainData: mainDataStepMessages,
    subData: subDataStepMessages
  };
}

// Helper function to extract messages from payload
function extractMessages(payload: any): string[] {
  if (Array.isArray(payload)) {
    return payload;
  } else if (payload && Array.isArray(payload.ai)) {
    return payload.ai;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.messages)) {
      return payload.messages;
    } else if (typeof payload.message === 'string') {
      return [payload.message];
    }
  }
  return [];
}