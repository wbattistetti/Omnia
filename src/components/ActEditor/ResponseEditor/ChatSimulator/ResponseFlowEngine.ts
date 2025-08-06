export interface FlowState {
  currentStep: 'start' | 'noInput' | 'noMatch' | 'confirmation' | 'success';
  escalationLevel: number; // 1, 2, 3
  messages: Array<{
    id: string;
    type: 'bot' | 'user';
    text: string;
    timestamp: Date;
    stepType?: string;
    escalationLevel?: number;
  }>;
  waitingForInput: boolean;
  completed: boolean;
  userInput?: string; // Store current user input for confirmation
}

export class ResponseFlowEngine {
  constructor(
    private ddt: any, 
    private translations: any = {}, 
    private selectedNode?: any
  ) {
    // Clean log of the final DDT structure
    console.log('🔍 DDT JSON FINALE:', JSON.stringify(this.ddt, null, 2));
  }

  start(): FlowState {
    const startMessage = this.getMessageForStep('start', 1);
    
    return {
      currentStep: 'start',
      escalationLevel: 1,
      messages: [{
        id: '1',
        type: 'bot',
        text: startMessage,
        timestamp: new Date(),
        stepType: 'start',
        escalationLevel: 1
      }],
      waitingForInput: true,
      completed: false
    };
  }

  processUserInput(state: FlowState, userInput: string): FlowState {
    const newMessages = [...state.messages];

    // Add user message if not empty
    if (userInput.trim()) {
      newMessages.push({
        id: Date.now().toString(),
        type: 'user',
        text: userInput,
        timestamp: new Date()
      });
    }

    // Decision logic based on special inputs
    if (userInput === '') {
      return this.handleNoInput(state, newMessages);
    } else if (userInput.toLowerCase() === 'xxxx') {
      return this.handleNoMatch(state, newMessages);
    } else if (state.currentStep === 'start' || state.currentStep === 'noInput' || state.currentStep === 'noMatch') {
      return this.handleConfirmation(state, newMessages, userInput);
    } else if (state.currentStep === 'confirmation') {
      return this.handleSuccess(state, newMessages);
    }

    return state;
  }

  private handleNoInput(state: FlowState, messages: any[]): FlowState {
    const nextLevel = Math.min(state.escalationLevel + 1, 3);
    const noInputMessage = this.getMessageForStep('noInput', nextLevel);
    
    messages.push({
      id: Date.now().toString(),
      type: 'bot',
      text: noInputMessage,
      timestamp: new Date(),
      stepType: 'noInput',
      escalationLevel: nextLevel
    });

    return {
      ...state,
      currentStep: 'noInput',
      escalationLevel: nextLevel,
      messages,
      waitingForInput: true
    };
  }

  private handleNoMatch(state: FlowState, messages: any[]): FlowState {
    const nextLevel = Math.min(state.escalationLevel + 1, 3);
    const noMatchMessage = this.getMessageForStep('noMatch', nextLevel);
    
    messages.push({
      id: Date.now().toString(),
      type: 'bot',
      text: noMatchMessage,
      timestamp: new Date(),
      stepType: 'noMatch',
      escalationLevel: nextLevel
    });

    return {
      ...state,
      currentStep: 'noMatch',
      escalationLevel: nextLevel,
      messages,
      waitingForInput: true
    };
  }

  private handleConfirmation(state: FlowState, messages: any[], userInput: string): FlowState {
    const confirmationMessage = this.getMessageForStep('confirmation', 1);
    const finalMessage = confirmationMessage.replace('{input}', userInput);
    
    messages.push({
      id: Date.now().toString(),
      type: 'bot',
      text: finalMessage,
      timestamp: new Date(),
      stepType: 'confirmation',
      escalationLevel: 1
    });

    return {
      ...state,
      currentStep: 'confirmation',
      escalationLevel: 1,
      messages,
      waitingForInput: true,
      userInput
    };
  }

  private handleSuccess(state: FlowState, messages: any[]): FlowState {
    const successMessage = this.getMessageForStep('success', 1);
    
    messages.push({
      id: Date.now().toString(),
      type: 'bot',
      text: successMessage,
      timestamp: new Date(),
      stepType: 'success',
      escalationLevel: 1
    });

    return {
      ...state,
      currentStep: 'success',
      escalationLevel: 1,
      messages,
      waitingForInput: false,
      completed: true
    };
  }

  private getMessageForStep(stepType: string, escalationLevel: number): string {
    // Try DDT assembled structure
    if (this.ddt?.mainData?.steps && Array.isArray(this.ddt.mainData.steps)) {
      const stepGroup = this.ddt.mainData.steps.find((s: any) => s.type === stepType);
      if (stepGroup?.escalations && stepGroup.escalations[escalationLevel - 1]) {
        const escalation = stepGroup.escalations[escalationLevel - 1];
        const action = escalation.actions?.[0];
        if (action?.parameters?.[0]?.value) {
          const translationKey = action.parameters[0].value;
          
          // Try different translation sources
          const translationsSource = this.ddt.translations || this.translations || {};
          const message = translationsSource[translationKey];
          if (message) {
            return message;
          }
        }
      }
    }

    // Try selected node structure
    if (this.selectedNode?.steps && Array.isArray(this.selectedNode.steps)) {
      const stepGroup = this.selectedNode.steps.find((s: any) => s.type === stepType);
      if (stepGroup?.escalations && stepGroup.escalations[escalationLevel - 1]) {
        const escalation = stepGroup.escalations[escalationLevel - 1];
        const action = escalation.actions?.[0];
        if (action?.parameters?.[0]?.value) {
          const translationKey = action.parameters[0].value;
          
          // Try different translation sources
          const translationsSource = this.ddt?.translations || this.translations || {};
          const message = translationsSource[translationKey];
          if (message) {
            return message;
          }
        }
      }
    }

    // Try legacy structures
    const node = this.selectedNode || this.ddt?.mainData || this.ddt;
    if (Array.isArray(node?.steps)) {
      const step = node.steps.find((s: any) => s.type === stepType);
      if (step?.escalations && step.escalations[escalationLevel - 1]) {
        const escalation = step.escalations[escalationLevel - 1];
        const action = escalation.actions?.[0];
        if (action?.parameters?.[0]?.value) {
          const translationKey = action.parameters[0].value;
          
          // Try different translation sources
          const translationsSource = this.ddt?.translations || this.translations || {};
          const message = translationsSource[translationKey];
          if (message) {
            return message;
          }
        }
      }
    }
    
    if (node?.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
      const stepActions = node.steps[stepType];
      if (Array.isArray(stepActions) && stepActions[escalationLevel - 1]) {
        const action = stepActions[escalationLevel - 1];
        if (action?.parameters?.[0]?.value) {
          const translationKey = action.parameters[0].value;
          
          // Try different translation sources
          const translationsSource = this.ddt?.translations || this.translations || {};
          const message = translationsSource[translationKey];
          if (message) {
            return message;
          }
        }
        if (action.text) {
          return action.text;
        }
      }
    }
    
    if (this.ddt?.steps && typeof this.ddt.steps === 'object') {
      const stepMapping: Record<string, string> = {
        'start': 'normal',
        'noInput': 'noInput',
        'noMatch': 'noMatch',
        'confirmation': 'explicitConfirmation',
        'success': 'success'
      };
      
      const mappedStepType = stepMapping[stepType] || stepType;
      const stepActions = this.ddt.steps[mappedStepType];
      
      if (Array.isArray(stepActions) && stepActions[escalationLevel - 1]) {
        const action = stepActions[escalationLevel - 1];
        if (action.text) {
          return action.text;
        }
      }
    }
    
    // Fallback messages
    return this.getDefaultMessage(stepType, escalationLevel);
  }

  private getDefaultMessage(stepType: string, escalationLevel: number): string {
    const defaults: Record<string, string[]> = {
      start: [
        'Please provide your information.',
        'Could you please provide the required information?', 
        'We need this information to continue.'
      ],
      noInput: [
        'I didn\'t receive any input. Please try again.',
        'Could you please provide a response?',
        'We really need your input to continue. Please respond.'
      ],
      noMatch: [
        'I didn\'t understand that format. Please try again.',
        'That doesn\'t seem to match what we\'re looking for. Could you try again?',
        'Please check the format and try again. We need valid input.'
      ],
      confirmation: [
        'Is this correct: {input}?',
        'Can you confirm this is right: {input}?',
        'Please verify this information: {input}'
      ],
      success: [
        'Thank you! Information received successfully.',
        'Perfect! We have what we need.',
        'Great! All done.'
      ]
    };
    
    const messages = defaults[stepType] || [`[${stepType} message]`];
    return messages[Math.min(escalationLevel - 1, messages.length - 1)];
  }
}