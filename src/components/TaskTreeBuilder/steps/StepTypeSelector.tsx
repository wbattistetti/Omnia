import React from 'react';
import ChatBox, { ChatMessage } from '../ChatBox';
import { ddtStep2 } from '../../../services/DDTApiService';

interface StepTypeSelectorProps {
  typeInfo: { type: string; description: string };
  onTypeInfoChange: (info: { type: string; description: string }) => void;
  onConfirm: () => void;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
}

const StepTypeSelector: React.FC<StepTypeSelectorProps> = ({ typeInfo, onTypeInfoChange, onConfirm, chatHistory, setChatHistory }) => {
  const [loading, setLoading] = React.useState(false);

  const handleSend = async (msg: string) => {
    setChatHistory([...chatHistory, { sender: 'user', message: msg }]);
    setLoading(true);
    const aiMsg = await ddtStep2(msg);
    setChatHistory([...chatHistory, { sender: 'user', message: msg }, { sender: 'ai', message: aiMsg }]);
    // Parsing: estrai primo word come tipo, resto come descrizione
    const [type, ...descParts] = aiMsg.split(' ', 2);
    const description = descParts.length > 0 ? descParts[0] : aiMsg;
    onTypeInfoChange({ type, description });
    setLoading(false);
    // Conferma automatica dopo risposta AI
    onConfirm();
  };

  return (
    <div>
      <ChatBox history={chatHistory} onSend={handleSend} loading={loading} inputPlaceholder="Es: data di nascita, email, codice fiscale..." />
    </div>
  );
};

export default StepTypeSelector; 