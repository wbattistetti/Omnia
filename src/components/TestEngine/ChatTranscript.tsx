import React from 'react';
import { ChatMessage } from '../../hooks/useTestEngine';

interface ChatTranscriptProps {
  transcript: ChatMessage[];
}

export const ChatTranscript: React.FC<ChatTranscriptProps> = ({ transcript }) => (
  <pre className="bg-gray-100 text-xs p-2 rounded overflow-x-auto mt-2">
    {transcript.map(m => `${m.sender}: ${m.text}`).join('\n')}
  </pre>
); 