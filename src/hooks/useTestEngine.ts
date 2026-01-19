import React, { useState } from 'react';
import { TaskTemplateItem } from '../types/project';
import { getTaskPrompt } from '../utils/agentActUtils';

export interface ChatMessage {
  id: string;
  sender: 'agent' | 'user';
  text: string;
}

/**
 * ✅ RINOMINATO: Hook per simulare un dialogo lineare su una lista di Tasks (rinominato da Agent Acts).
 */
export function useTestEngine(tasks: TaskTemplateItem[]) {
  const [step, setStep] = useState(0);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');

  // Mostra il messaggio dell'agente corrente
  function showCurrentAgentAct() {
    const task = tasks[step];
    if (!task) return;
    setTranscript(prev => [
      ...prev,
      {
        id: task.id,
        sender: 'agent',
        text: getTaskPrompt(task),
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

  // Quando lo step cambia, mostra il nuovo task
  // (Effetto collaterale: solo se non già presente nel transcript)
  React.useEffect(() => {
    if (step < tasks.length) {
      const task = tasks[step];
      if (task && !transcript.find(m => m.id === task.id && m.sender === 'agent')) {
        showCurrentAgentAct();
      }
    }
  }, [step, tasks]);

  return {
    step,
    transcript,
    userInput,
    setUserInput,
    sendUserMessage,
    isFinished: step >= tasks.length,
    reset: () => {
      setStep(0);
      setTranscript([]);
      setUserInput('');
    },
  };
}