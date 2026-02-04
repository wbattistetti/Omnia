import React, { useState } from 'react';

export interface ChatMessage {
  sender: 'user' | 'ai';
  message: string;
}

interface ChatBoxProps {
  history: ChatMessage[];
  onSend: (msg: string) => void;
  loading?: boolean;
  inputPlaceholder?: string;
  onCancel?: () => void;
}

const dotStyle = {
  animation: 'ai-dots 1.2s infinite',
  fontSize: 14,
  marginLeft: 1,
  marginRight: 1,
};

const ChatBox: React.FC<ChatBoxProps> = ({ history, onSend, loading, inputPlaceholder, onCancel }) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 4, padding: 0, background: '#fafbfc' }}>
      <style>{`
        @keyframes ai-dots {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
      `}</style>
      <div style={{ minHeight: 60, maxHeight: 140, overflowY: 'auto', marginBottom: 0 }}>
        {history.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left', margin: 0 }}>
            <span style={{
              display: msg.sender === 'ai' ? 'block' : 'inline-block',
              width: msg.sender === 'ai' ? '100%' : undefined,
              background: 'transparent',
              color: '#111', // sempre nero per tutte le bubble
              borderRadius: 3,
              padding: '3px 6px',
              fontSize: 14,
              wordBreak: 'break-word',
            }}>{msg.message}</span>
          </div>
        ))}
        {loading && (
          <div
            style={{
              color: '#2563eb',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              minHeight: 18
            }}
          >
            <span>Sto analizzando</span>
            <span style={{ display: 'flex', marginLeft: 2 }}>
              <span style={{ ...dotStyle, animationDelay: '0s' }}>.</span>
              <span style={{ ...dotStyle, animationDelay: '0.2s' }}>.</span>
              <span style={{ ...dotStyle, animationDelay: '0.4s' }}>.</span>
            </span>
          </div>
        )}
      </div>
      <div>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          style={{ width: '100%', padding: 3, borderRadius: 2, border: '1px solid #bbb', fontSize: 14, background: '#18181b', color: '#fff', marginBottom: 4 }}
          placeholder={inputPlaceholder || "Scrivi un messaggio..."}
          disabled={loading}
        />
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 8,
          margin: 0,
          padding: 0,
          height: 28,
          boxSizing: 'border-box'
        }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                fontSize: 12,
                minWidth: 60,
                height: 28,
                padding: 0,
                color: '#a21caf',
                background: 'transparent',
                border: '1px solid #a21caf',
                borderRadius: 3,
                cursor: 'pointer',
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box'
              }}
              onMouseOver={e => (e.currentTarget.style.background = '#f3e8ff')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              Annulla
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{
              fontSize: 12,
              minWidth: 60,
              height: 28,
              padding: 0,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box'
            }}
          >
            Invia
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox; 