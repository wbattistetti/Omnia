import React, { useEffect, useState } from 'react';
import ChatBox, { ChatMessage } from '../ChatBox';
import { ddtStep3, ddtStep3b } from '../../../services/DDTApiService';

interface StepConstraintEditorProps {
  constraints: string[];
  onConstraintsChange: (constraints: string[]) => void;
  onConfirm: () => void;
  chatHistory: ChatMessage[];
  setChatHistory: (history: ChatMessage[]) => void;
  meaning: string; // tipo di dato scelto
  desc: string;    // descrizione del dato
}

const StepConstraintEditor: React.FC<StepConstraintEditorProps> = ({ constraints, onConstraintsChange, onConfirm, chatHistory, setChatHistory, meaning, desc }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string>('');
  const [askedSuggestions, setAskedSuggestions] = useState(false);

  // Chiedi suggerimenti IA appena noto il tipo di dato
  useEffect(() => {
    if (meaning && !askedSuggestions) {
      setLoading(true);
      ddtStep3(meaning, desc).then(aiMsg => {
        setSuggestions(aiMsg);
        setChatHistory([...chatHistory, { sender: 'ai', message: `Che controlli di validazione vuoi applicare al dato? (${aiMsg})` }]);
        setLoading(false);
        setAskedSuggestions(true);
      });
    }
    // eslint-disable-next-line
  }, [meaning]);

  // Gestione invio risposta utente (constraint desiderati)
  const handleSend = async (msg: string) => {
    setChatHistory([...chatHistory, { sender: 'user', message: msg }]);
    setLoading(true);
    const aiMsg2 = await ddtStep3b(msg, meaning, desc);
    setChatHistory([...chatHistory, { sender: 'user', message: msg }, { sender: 'ai', message: aiMsg2 }]);
    // Parsing: estrai lista constraint da aiMsg2
    const constraintsList = aiMsg2.split(',').map((s: string) => s.trim()).filter(Boolean);
    onConstraintsChange(constraintsList);
    setLoading(false);
    onConfirm();
  };

  return (
    <div>
      <ChatBox
        history={chatHistory}
        onSend={handleSend}
        loading={loading}
        inputPlaceholder="Es: obbligatorio, formato data, età minima..."
      />
      <ul style={{ margin: '8px 0', paddingLeft: 16 }}>
        {constraints.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </div>
  );
};

export default StepConstraintEditor; 