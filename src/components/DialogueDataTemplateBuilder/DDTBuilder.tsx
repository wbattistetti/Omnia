import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';

interface DDTBuilderProps {
  onComplete?: (newDDT: any) => void;
  onCancel?: () => void;
}

const initialPrompt = 'Che dato vuoi acquisire?(es: data di nascita, email, ecc):';

// Shimmer CSS (puoi spostarlo in un file CSS o styled-component)
const shimmerStyle = `
@keyframes shimmer {
  0% { box-shadow: 0 0 0 0 #a21caf44; }
  40% { box-shadow: 0 0 0 6px #a21caf88; }
  100% { box-shadow: 0 0 0 0 #a21caf00; }
}
.ddt-shimmer {
  animation: shimmer 0.7s cubic-bezier(0.4,0,0.2,1);
}
`;

if (typeof document !== 'undefined' && !document.getElementById('ddt-shimmer-style')) {
  const style = document.createElement('style');
  style.id = 'ddt-shimmer-style';
  style.innerHTML = shimmerStyle;
  document.head.appendChild(style);
}

async function fetchStep2IA(userDesc: string) {
  const res = await fetch('/step2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userDesc) });
  return (await res.json()).ai;
}

async function fetchStep4DDT(meaning: string, desc: string) {
  // Chiamata a /step4 senza constraint (stringa vuota)
  const res = await fetch('/step4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meaning, desc, constraints: '' })
  });
  return (await res.json()).ai;
}

const DDTBuilder: React.FC<DDTBuilderProps> = ({ onComplete, onCancel }) => {
  const [input, setInput] = useState('');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [meaning, setMeaning] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0: input, 1: review/crea
  const [messages, setMessages] = useState<any>(null); // runtime strings per la treeview/editor
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [step]);

  useEffect(() => {
    setShimmer(true);
    const t = setTimeout(() => setShimmer(false), 700);
    return () => clearTimeout(t);
  }, [step]);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const aiResp = await fetchStep2IA(input);
      console.log('IA response step 1:', aiResp);
      const [m, ...dArr] = aiResp.split(' ');
      setMeaning(m);
      setDesc(dArr.join(' '));
      setInput('');
      setStep(1);
    } catch (err) {
      console.error('Errore comunicazione IA:', err);
      setError('Errore di comunicazione con la IA. Riprova o contatta il supporto.');
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Chiedi alla IA la struttura DDT completa (steps, prompt, escalation...)
      const response = await fetchStep4DDT(meaning, desc);
      // Ora la IA restituisce { ddt, messages }
      if (response.ddt && response.messages) {
        setMessages(response.messages); // puoi usare questo stato per la treeview/editor
        if (onComplete) onComplete(response.ddt);
      } else if (onComplete) {
        // fallback: se la IA restituisce solo il DDT
        onComplete(response);
      }
    } catch (err) {
      console.error('Errore creazione DDT:', err);
      setError('Errore durante la creazione del template DDT. Riprova o contatta il supporto.');
    }
    setLoading(false);
  };

  const summaryLabels = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
      {meaning && (
        <span style={{ background: '#ede9fe', color: '#111', borderRadius: 8, padding: '2px 10px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
          Vuoi: <span style={{ fontWeight: 700, margin: '0 4px' }}>{meaning}</span>
          <Pencil size={14} style={{ marginLeft: 6, cursor: 'pointer' }} onClick={() => setStep(0)} />
        </span>
      )}
    </div>
  );

  const questionBox = (
    <div className={shimmer ? 'ddt-shimmer' : ''} style={{
      background: '#18181b',
      borderRadius: 12,
      border: '2px solid #a21caf',
      padding: 16,
      marginBottom: 10,
      transition: 'box-shadow 0.3s',
      position: 'relative',
      color: '#111',
      fontWeight: 500,
      fontSize: 16
    }}>
      {prompt}
    </div>
  );

  const inputBox = step === 0 && (
    <input
      ref={inputRef}
      type="text"
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && input.trim() && !loading) handleSend(); }}
      placeholder={'Es: data di nascita, email, codice fiscale'}
      style={{
        width: '100%',
        marginTop: 2,
        padding: '8px 10px',
        borderRadius: 8,
        border: '1px solid #a21caf',
        background: '#27272a',
        color: '#fff',
        fontSize: 15,
        outline: 'none',
        marginBottom: 2
      }}
      disabled={loading}
    />
  );

  const buttons = (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      {onCancel && (
        <button onClick={onCancel} style={{ color: '#a21caf', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 500 }} disabled={loading}>
          Annulla
        </button>
      )}
      {step === 0 ? (
        <button onClick={handleSend} style={{ background: '#a21caf', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 18px', fontWeight: 500, cursor: 'pointer' }} disabled={loading || !input.trim()}>
          Invia
        </button>
      ) : (
        <button onClick={handleCreate} style={{ background: '#a21caf', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 18px', fontWeight: 500, cursor: 'pointer' }} disabled={loading}>
          Crea
        </button>
      )}
    </div>
  );

  return (
    <div
      style={{
        maxWidth: 400,
        margin: '0 auto',
        border: '2px solid #a21caf',
        borderRadius: 16,
        boxShadow: '0 2px 16px 0 #0002',
        background: '#18181b',
        padding: 0,
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#a21caf',
          color: '#fff',
          padding: '10px 0 8px 0',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 17,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          letterSpacing: 0.2,
        }}
      >
        Create data template
      </div>
      <div style={{ padding: 22, paddingTop: 18 }}>
        {/* Prompt */}
        {step === 0 && (
          <div style={{
            color: '#fff',
            fontWeight: 600,
            fontSize: 18,
            marginBottom: 8,
            textAlign: 'left',
            lineHeight: 1.3
          }}>
            Che dato vuoi acquisire?<br />
            <span style={{ fontWeight: 400, fontSize: 15, color: '#e0e0e0' }}>
              (es: data di nascita, email, ecc):
            </span>
          </div>
        )}
        {summaryLabels}
        {error && (
          <div style={{ color: '#dc2626', background: '#fef2f2', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontWeight: 500 }}>
            {error}
          </div>
        )}
        {step === 0 && inputBox}
        {buttons}
      </div>
    </div>
  );
};

export default DDTBuilder; 