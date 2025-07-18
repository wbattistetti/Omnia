import React, { useState } from 'react';
import { AgentActItem } from '../../types/project';
import { getAgentActPrompt } from '../../utils/agentActUtils';

interface ChatPanelProps {
  agentActs: AgentActItem[];
  testNodeId?: string | null;
}

function getNextBlock(agentActs: AgentActItem[], startIdx: number) {
  // Restituisce gli indici degli agentActs da mostrare fino al prossimo che aspetta risposta (incluso)
  const indices = [];
  for (let i = startIdx; i < agentActs.length; i++) {
    indices.push(i);
    if (agentActs[i].userActs) break;
  }
  return indices;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ agentActs, testNodeId }) => {
  // Stato: lista delle risposte utente (string | undefined)
  const [userReplies, setUserReplies] = useState<(string | undefined)[]>([]);
  const [inputValue, setInputValue] = useState('');

  // Calcola quali prompt mostrare: tutti fino al prossimo che aspetta risposta
  let shownIndices: number[] = [];
  let idx = 0;
  while (idx < agentActs.length) {
    const block = getNextBlock(agentActs, idx);
    shownIndices.push(...block);
    if (userReplies.length <= shownIndices.length - 1) break; // fermati al primo prompt che aspetta risposta non ancora risposto
    idx = shownIndices.length;
  }

  // L'indice del prompt corrente che aspetta risposta
  const currentPromptIdx = shownIndices.find(i => agentActs[i].userActs && userReplies[i] === undefined);

  function handleSend() {
    if (!inputValue.trim() || currentPromptIdx === undefined) return;
    const newReplies = [...userReplies];
    newReplies[currentPromptIdx] = inputValue;
    setUserReplies(newReplies);
    setInputValue('');
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-white h-full overflow-y-auto">
      {shownIndices.map((i) => (
        <div key={agentActs[i].id} className="flex flex-col gap-1">
          {/* Prompt agente */}
          <div className="self-start bg-blue-100 text-blue-900 rounded-lg px-4 py-2 max-w-xs shadow text-sm">
            {getAgentActPrompt(agentActs[i])}
          </div>
          {/* Risposta utente, se presente */}
          {userReplies[i] !== undefined && (
            <div className="self-end bg-yellow-100 text-yellow-900 rounded-lg px-4 py-2 max-w-xs shadow text-sm">
              {userReplies[i]}
            </div>
          )}
          {/* Se questo è il prompt corrente che aspetta risposta, mostra la textbox */}
          {i === currentPromptIdx && (
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