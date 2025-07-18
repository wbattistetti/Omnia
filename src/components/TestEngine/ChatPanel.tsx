import React, { useState } from 'react';
import { AgentActItem } from '../../types/project';
import { getAgentActPrompt } from '../../utils/agentActUtils';

interface ChatPanelProps {
  agentActs: AgentActItem[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ agentActs }) => {
  // Stato: lista delle risposte utente (string | undefined)
  const [userReplies, setUserReplies] = useState<(string | undefined)[]>([]);
  const [inputValue, setInputValue] = useState('');

  // Trova il primo agentAct che aspetta risposta e non ha ancora risposta
  const currentStep = userReplies.length;
  const currentAct = agentActs[currentStep];
  const waitingForReply = currentAct && currentAct.userActs;

  function handleSend() {
    if (!inputValue.trim()) return;
    setUserReplies([...userReplies, inputValue]);
    setInputValue('');
  }

  // Mostra tutti i prompt e le risposte fino all'ultimo step raggiunto
  return (
    <div className="flex flex-col gap-2 p-4 bg-white h-full overflow-y-auto">
      {agentActs.slice(0, userReplies.length + 1).map((act, idx) => (
        <div key={act.id} className="flex flex-col gap-1">
          {/* Prompt agente */}
          <div className="self-start bg-blue-100 text-blue-900 rounded-lg px-4 py-2 max-w-xs shadow text-sm">
            {getAgentActPrompt(act)}
          </div>
          {/* Risposta utente, se presente */}
          {userReplies[idx] !== undefined && (
            <div className="self-end bg-yellow-100 text-yellow-900 rounded-lg px-4 py-2 max-w-xs shadow text-sm">
              {userReplies[idx]}
            </div>
          )}
          {/* Se questo è il prompt corrente che aspetta risposta, mostra la textbox */}
          {idx === userReplies.length && act.userActs && (
            <form
              className="flex gap-2 mt-1"
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
            >
              <input
                className="flex-1 border rounded px-2 py-1 text-sm"
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Scrivi la tua risposta..."
                autoFocus
              />
              <button
                className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
                type="submit"
                disabled={!inputValue.trim()}
              >
                Invia
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}; 