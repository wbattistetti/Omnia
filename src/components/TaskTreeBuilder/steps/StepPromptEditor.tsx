import React from 'react';
import ChatBox, { ChatMessage } from '../ChatBox';
import { ddtStep4 } from '../../../services/DDTApiService';

interface StepPromptEditorProps {
  prompts: {
    noInput: string;
    noMatch: string;
    explicitConfirmation: string;
    success: string;
    violations: { [constraintKey: string]: string };
  };
  onPromptsChange: (prompts: StepPromptEditorProps['prompts']) => void;
  onConfirm: () => void;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
}

const StepPromptEditor: React.FC<StepPromptEditorProps> = ({ prompts, onPromptsChange, onConfirm, chatHistory, setChatHistory }) => {
  const [loading, setLoading] = React.useState(false);
  const [meaning, setMeaning] = React.useState(''); // Da passare come prop se serve
  const [desc, setDesc] = React.useState(''); // Da passare come prop se serve
  const [constraints, setConstraints] = React.useState(''); // Da passare come prop se serve

  const handleSend = async (msg: string) => {
    setChatHistory([...chatHistory, { sender: 'user', message: msg }]);
    setLoading(true);
    const aiMsg = await ddtStep4(meaning, desc, constraints);
    setChatHistory([...chatHistory, { sender: 'user', message: msg }, { sender: 'ai', message: aiMsg }]);
    // Parsing: estrai prompt da aiMsg se serve
    onPromptsChange({ ...prompts, noInput: aiMsg }); // Semplificato, adatta secondo struttura
    setLoading(false);
    // Conferma automatica dopo risposta AI
    onConfirm();
  };

  return (
    <div>
      <ChatBox history={chatHistory} onSend={handleSend} loading={loading} inputPlaceholder="Es: Cambia il messaggio di errore per età minima..." />
    </div>
  );
};

export default StepPromptEditor; 