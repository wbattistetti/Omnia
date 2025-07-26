import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Hourglass } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { FunctionComponent } from 'react';
import SupportReportModal from '../SupportReportModal';

interface DDTBuilderProps {
  onComplete?: (newDDT: any, messages?: any) => void;
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

// Helper to check if a value is a valid Lucide React component
function isLucideComponent(comp: any): comp is FunctionComponent<any> {
  return typeof comp === 'function' && comp.length <= 1;
}

const DDTBuilder: React.FC<DDTBuilderProps> = ({ onComplete, onCancel }) => {
  const [input, setInput] = useState('');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [meaning, setMeaning] = useState('');
  const [meaningIcon, setMeaningIcon] = useState<keyof typeof LucideIcons | null>(null);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [shimmer, setShimmer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0: input, 1: review/crea
  const [messages, setMessages] = useState<any>(null); // runtime strings per la treeview/editor
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorData, setErrorData] = useState<any>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when wizard is mounted (es. riapertura)
  useEffect(() => {
    setInput('');
    setPrompt(initialPrompt);
    setMeaning('');
    setDesc('');
    setLoading(false);
    setShimmer(false);
    setError(null);
    setStep(0);
    setMessages(null);
    setShowSupportModal(false);
    setIsSending(false);
    setSent(false);
    setErrorData(null);
    setWarning(null);
  }, []);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [step]);

  useEffect(() => {
    setShimmer(true);
    const t = setTimeout(() => setShimmer(false), 700);
    return () => clearTimeout(t);
  }, [step]);

  // Animazione puntini
  const [dots, setDots] = useState('');
  useEffect(() => {
    if ((loading && step === 0) || (loading && step === 1)) {
      const interval = setInterval(() => {
        setDots(d => d.length < 3 ? d + '.' : '');
      }, 400);
      return () => clearInterval(interval);
    } else {
      setDots('');
    }
  }, [loading, step]);

  // Effetto cursore spinner globale
  useEffect(() => {
    if (loading) {
      document.body.style.cursor = 'progress';
    } else {
      document.body.style.cursor = '';
    }
    return () => { document.body.style.cursor = ''; };
  }, [loading]);

  const handleSend = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const aiResp = await fetchStep2IA(input);
      if (!aiResp || aiResp.error === 'unrecognized_data_type') {
        setWarning('Non ho capito cosa intendi. Che tipo di dato vuoi acquisire? Puoi riscrivere meglio?');
        setLoading(false);
        return;
      }
      setMeaning(aiResp.type);
      setMeaningIcon(aiResp.icon || null);
      setDesc('');
      setInput('');
      setStep(1);
    } catch (err) {
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
      // Validate response
      if (!response || !response.ddt || !response.messages || typeof response.ddt !== 'object' || typeof response.messages !== 'object' || Object.keys(response.ddt).length === 0) {
        setError('La IA non ha restituito un Data Template valido. Riprova o controlla la connessione.');
        setLoading(false);
        return;
      }
      setMessages(response.messages);
      if (onComplete) onComplete(response.ddt, response.messages);
      setLoading(false);
      // RIMOSSO: alert('Sponsorizza!');
      if (onCancel) onCancel(); // chiudi wizard
    } catch (err: any) {
      setError('Errore nella creazione del Data Template: ' + (err.message || err));
      setLoading(false);
    }
  };

  const handleSupport = () => {
    setErrorData({
      errorId: error || 'Errore sconosciuto',
      step,
      input,
      browser: navigator.userAgent,
      os: navigator.platform
    });
    if (onCancel) onCancel();
    setShowSupportModal(true);
  };
  const handleSendReport = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSent(true);
    }, 1500);
  };
  const handleCloseModal = () => {
    setShowSupportModal(false);
    setIsSending(false);
    setSent(false);
  };

  // LABEL TEMPLATE FOR
  const summaryLabels = (
    meaning ? (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, marginTop: 2 }}>
        <span style={{ fontWeight: 400, fontSize: 15, color: '#fff', textAlign: 'left', marginRight: 0 }}>
          For
        </span>
        <span style={{
          border: '1.5px solid #a21caf',
          background: 'rgba(162,28,175,0.06)',
          color: '#fff',
          borderRadius: 8,
          padding: '2px 14px',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0.2,
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: 6
        }}>
          {meaningIcon &&
            isLucideComponent(LucideIcons[meaningIcon as keyof typeof LucideIcons]) &&
            (LucideIcons[meaningIcon as keyof typeof LucideIcons] as Function).length <= 1
            ? React.createElement(LucideIcons[meaningIcon as keyof typeof LucideIcons] as FunctionComponent<any>, { size: 28, style: { marginRight: 10 } })
            : null}
          {meaning}
          <span title="Correggi tipo di dato">
            <Pencil size={16} style={{ marginLeft: 8, cursor: 'pointer', color: '#a21caf' }} onClick={() => setStep(0)} />
          </span>
        </span>
      </div>
    ) : null
  );

  // MESSAGGIO ANALISI IA
  const analyzingBox = (loading && step === 0) ? (
    <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 6, marginLeft: 2, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Hourglass size={18} style={{ color: '#2563eb', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
      Sto analizzando{dots}
    </div>
  ) : null;

  // WARNING BOX
  const warningBox = warning ? (
    <div style={{ fontSize: 13, color: '#f59e42', marginBottom: 6, marginLeft: 2, fontWeight: 500 }}>
      {warning}
    </div>
  ) : null;

  // MESSAGGIO CREAZIONE TEMPLATE
  const creatingBox = (loading && step === 1) ? (
    <div style={{ fontSize: 13, color: '#2563eb', marginBottom: 6, marginLeft: 2, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
      <Hourglass size={18} style={{ color: '#2563eb', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
      Sto costruendo il template{dots}
    </div>
  ) : null;

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

  // PULSANTI ALLINEATI
  const buttons = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 18 }}>
      {onCancel && (
        <button onClick={onCancel} style={{ color: '#a21caf', border: 'none', background: 'none', cursor: loading ? 'progress' : 'pointer', fontWeight: 500, fontSize: 15, padding: '4px 0' }} disabled={loading}>
          Annulla
        </button>
      )}
      {step === 0 ? (
        <button onClick={handleSend} style={{ background: '#a21caf', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 28px', fontWeight: 500, cursor: loading ? 'progress' : 'pointer', fontSize: 15, marginLeft: 'auto' }} disabled={loading || !input.trim()}>
          Invia
        </button>
      ) : (
        <button style={{ background: '#a21caf', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 28px', fontWeight: 500, cursor: loading ? 'progress' : 'pointer', fontSize: 15, marginLeft: 'auto' }} disabled={loading} onClick={handleCreate}>
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
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 18, marginBottom: 8, textAlign: 'left', lineHeight: 1.3 }}>
            Che dato vuoi acquisire?<br />
            <span style={{ fontWeight: 400, fontSize: 15, color: '#e0e0e0' }}>
              (es: data di nascita, email, ecc):
            </span>
          </div>
        )}
        {summaryLabels}
        {warningBox}
        {analyzingBox}
        {creatingBox}
        {error && (
          <div style={{ background: '#450a0a', borderRadius: 6, padding: '10px 10px', marginBottom: 8, fontWeight: 500, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ color: '#f87171', fontWeight: 700, fontSize: 17, marginBottom: 4 }}>AI is not responding!</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { step === 0 ? handleSend() : handleCreate(); }}
                style={{ background: '#fff', color: '#a21caf', border: '1px solid #a21caf', borderRadius: 4, padding: '2px 10px', fontWeight: 500, fontSize: 12, cursor: loading ? 'progress' : 'pointer' }}
              >
                Retry
              </button>
              <button
                onClick={handleSupport}
                style={{ background: '#a21caf', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 10px', fontWeight: 500, fontSize: 12, cursor: loading ? 'progress' : 'pointer' }}
              >
                Contact support
              </button>
            </div>
          </div>
        )}
        {step === 0 && inputBox}
        {buttons}
      </div>
      <SupportReportModal
        isOpen={showSupportModal}
        onClose={handleCloseModal}
        errorData={errorData || { errorId: error || 'Errore sconosciuto' }}
        onSend={handleSendReport}
        isLoading={isSending}
        sent={sent}
      />
    </div>
  );
};

export default DDTBuilder; 