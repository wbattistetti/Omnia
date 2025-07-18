import React, { useState } from 'react';
import { AgentActItem } from '../types/project';
import { getAgentActPrompt } from '../utils/agentActUtils';

export interface ChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
}

/**
 * Hook per simulare un dialogo lineare su una lista di Agent Acts.
 */
export function useTestEngine(agentActs: AgentActItem[]) {
  const [step, setStep] = useState(0);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');

  // Mostra il messaggio dell'agente corrente
  function showCurrentAgentAct() {
    const act = agentActs[step];
    if (!act) return;
    setTranscript(prev => [
      ...prev,
      {
        id: act.id,
        sender: 'agent',
        text: getAgentActPrompt(act),
      },
    ]);
  }

  // L'utente invia una risposta
  function sendUserMessage() {
    if (!userInput.trim()) return;
    setTranscript(prev => [
      ...prev,
      {
        id: `user-${step}`,
        sender: 'user',
        text: userInput,
      },
    ]);
    setUserInput('');
    // Avanza allo step successivo dopo la risposta
    setStep(s => s + 1);
  }

  // Quando lo step cambia, mostra il nuovo agent act
  // (Effetto collaterale: solo se non già presente nel transcript)
  React.useEffect(() => {
    if (step < agentActs.length) {
      const act = agentActs[step];
      if (act && !transcript.find(m => m.id === act.id && m.sender === 'agent')) {
        showCurrentAgentAct();
      }
    }
  }, [step, agentActs]);

  return {
    step,
    transcript,
    userInput,
    setUserInput,
    sendUserMessage,
    isFinished: step >= agentActs.length,
    reset: () => {
      setStep(0);
      setTranscript([]);
      setUserInput('');
    },
  };
} 