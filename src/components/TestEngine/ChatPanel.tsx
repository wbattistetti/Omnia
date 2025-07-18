import React, { useState } from 'react';
import { NodeRowData } from '../../types/project';
import { getAgentActPrompt } from '../../utils/agentActUtils';

interface ChatPanelProps {
  // agentActs: AgentActItem[]; // rimosso
  testNodeId?: string | null;
  userReplies: (string | undefined)[];
  setUserReplies: React.Dispatch<React.SetStateAction<(string | undefined)[]>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  onSend: (currentPromptIdx: number | undefined) => void;
  onClear: () => void;
  showChat?: boolean;
  nodeRows: NodeRowData[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ testNodeId, userReplies, setUserReplies, inputValue, setInputValue, onSend, onClear, showChat, nodeRows }) => {
  if (showChat === false) return null;
  // Filtra solo le row agent
  const agentRows = nodeRows.filter(row => row.categoryType === 'agentActs');

  // DEBUG LOG: mostra agentRows e userActs
  console.log('[ChatPanel] agentRows dettagliato:', agentRows);

  // Calcola quali prompt mostrare: tutti fino al prossimo che aspetta risposta
  let shownIndices: number[] = [];
  let idx = 0;
  while (idx < agentRows.length) {
    shownIndices.push(idx);
    // Se la row ha userActs, fermati dopo questa
    if (agentRows[idx].userActs) break;
    idx++;
  }
  if (userReplies.length <= shownIndices.length - 1) {
    // fermati al primo prompt che aspetta risposta non ancora risposto
    shownIndices = shownIndices.slice(0, userReplies.length + 1);
  }
  // L'indice del prompt corrente che aspetta risposta
  const currentPromptIdx = shownIndices.find(i => agentRows[i].userActs && userReplies[i] === undefined);

  function handleSend() {
    onSend(currentPromptIdx);
  }

  function handleClear() {
    onClear();
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-white h-full overflow-y-auto relative">
      {/* Pulsante Clear chat */}
      {userReplies.length > 0 && (
        <button
          className="absolute top-2 right-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 rounded px-2 py-1 z-10"
          onClick={handleClear}
        >
          Clear chat
        </button>
      )}
      {shownIndices.map((i) => (
        <div key={agentRows[i].id} className="flex flex-col gap-1">
          {/* Prompt agente */}
          <div className="self-start bg-blue-100 text-blue-900 rounded-lg px-4 py-2 max-w-xs shadow text-sm">
            {agentRows[i].text}
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