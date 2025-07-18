import React from 'react';
import { ChatMessage } from '../../hooks/useTestEngine';
import { ChatBubble } from './ChatBubble';

interface ChatBodyProps {
  transcript: ChatMessage[];
}

export const ChatBody: React.FC<ChatBodyProps> = ({ transcript }) => {
  return (
    <div className="flex flex-col gap-1 p-2 overflow-y-auto h-64 bg-gray-50 rounded">
      {transcript.map(msg => (
        <ChatBubble key={msg.id + msg.sender} message={msg} />
      ))}
    </div>
  );
}; 