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
        background: 'rgba(239, 68, 68, 0.2)', // Rosso spento con trasparenza 80%
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label
          style={{
            fontSize: 12,
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
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
            flex: 1,
            padding: '6px 8px',
            border: '2px solid #9ca3af',
            borderRadius: 6,
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <label
          style={{
            fontSize: 12,
            opacity: 0.8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            whiteSpace: 'nowrap',
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
            flex: 1,
            padding: '6px 8px',
            border: '2px solid #9ca3af',
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
}

