import React from 'react';
import { ChatMessage } from '../../hooks/useTestEngine';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAgent = message.sender === 'agent';
  return (
    <div
      className={`flex ${isAgent ? 'justify-start' : 'justify-end'} mb-2`}
    >
      <div
        className={`rounded-lg px-4 py-2 max-w-xs break-words shadow text-sm
          ${isAgent ? 'bg-blue-100 text-blue-900' : 'bg-yellow-100 text-yellow-900'}
        `}
      >
        {message.text}
      </div>
    </div>
  );
}; 