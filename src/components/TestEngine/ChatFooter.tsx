import React from 'react';

interface ChatFooterProps {
  userInput: string;
  setUserInput: (val: string) => void;
  sendUserMessage: () => void;
  isFinished: boolean;
}

export const ChatFooter: React.FC<ChatFooterProps> = ({ userInput, setUserInput, sendUserMessage, isFinished }) => {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') sendUserMessage();
  }
  return (
    <div className="flex gap-2 p-2 border-t bg-white">
      <input
        className="flex-1 border rounded px-2 py-1 text-sm"
        type="text"
        value={userInput}
        onChange={e => setUserInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isFinished}
        placeholder={isFinished ? 'Fine del test' : 'Scrivi una risposta...'}
      />
      <button
        className="bg-blue-500 text-white px-3 py-1 rounded disabled:opacity-50"
        onClick={sendUserMessage}
        disabled={isFinished || !userInput.trim()}
      >
        Invia
      </button>
    </div>
  );
}; 