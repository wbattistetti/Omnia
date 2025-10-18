import React from 'react';
import { MessageCircle } from 'lucide-react';

interface WaitingMessagesConfigProps {
  waitingNER: string;
  setWaitingNER: (value: string) => void;
  waitingLLM: string;
  setWaitingLLM: (value: string) => void;
}

/**
 * Configuration for NER and LLM waiting messages
 */
export default function WaitingMessagesConfig({
  waitingNER,
  setWaitingNER,
  waitingLLM,
  setWaitingLLM,
}: WaitingMessagesConfigProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        padding: 8,
        background: '#f0fdf4',
        borderRadius: 8,
      }}
    >
      <div>
        <label
          style={{
            fontSize: 12,
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
          }}
        >
          <MessageCircle size={14} />
          Waiting NER
        </label>
        <input
          value={waitingNER}
          onChange={(e) => setWaitingNER(e.target.value)}
          title="Testo mostrato all'utente mentre si attende il riconoscimento NER"
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 6,
          }}
        />
      </div>
      <div>
        <label
          style={{
            fontSize: 12,
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
          }}
        >
          <MessageCircle size={14} />
          Waiting LLM
        </label>
        <input
          value={waitingLLM}
          onChange={(e) => setWaitingLLM(e.target.value)}
          title="Testo mostrato all'utente mentre si attende l'analisi LLM"
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #ddd',
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
}

