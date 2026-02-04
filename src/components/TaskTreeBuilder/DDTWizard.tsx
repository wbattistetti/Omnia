import React, { useState } from 'react';
import useDDTOrchestrator from './orchestrator/useDDTOrchestrator';
import type { DDTGenerationStep } from './orchestrator/types';

const stepMessages: Record<DDTGenerationStep, string> = {
  structure: 'Sto generando la struttura del template...',
  constraints: 'Sto arricchendo i constraints...',
  scripts: 'Sto generando gli script di validazione...',
  messages: 'Sto generando i messaggi utente...',
  assemble: 'Sto assemblando il DDT finale...',
  done: 'Template generato con successo!',
  error: 'Errore nella generazione del template.'
};

function AnimatedMessage({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  React.useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, [children]);
  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s',
      minHeight: 32,
      fontSize: 18,
      fontWeight: 500,
      color: '#a21caf',
      margin: '24px 0'
    }}>{children}</div>
  );
}

export default function DDTWizard() {
  const { state, start, retry, step, error, finalDDT, messages } = useDDTOrchestrator();
  const [input, setInput] = useState('');

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 32 }}>
      <h2 style={{ color: '#a21caf', fontWeight: 700, fontSize: 28 }}>Creazione DDT</h2>
      <AnimatedMessage key={step}>{stepMessages[step]}</AnimatedMessage>
      {step === 'structure' && (
        <div style={{ margin: '24px 0' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Che tipo di dato vuoi acquisire? (es: data di nascita)"
            style={{ fontSize: 16, padding: 8, width: '80%', borderRadius: 6, border: '1px solid #ccc' }}
          />
          <button
            onClick={() => start(input)}
            style={{ marginLeft: 16, background: '#a21caf', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 24px', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
            disabled={!input.trim() || step !== 'structure'}
          >
            Crea DDT
          </button>
        </div>
      )}
      {step === 'error' && (
        <div style={{ color: '#b91c1c', background: '#fee2e2', borderRadius: 6, padding: 16, margin: '24px 0', fontWeight: 500 }}>
          <span>{error}</span>
          <button onClick={retry} style={{ marginLeft: 24, background: '#a21caf', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 18px', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>
            Riprova
          </button>
        </div>
      )}
      {step === 'done' && finalDDT && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ color: '#a21caf', fontWeight: 600, fontSize: 22 }}>Anteprima DDT finale</h3>
          <pre style={{ background: '#f3f3f3', borderRadius: 8, padding: 18, fontSize: 14, maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(finalDDT, null, 2)}</pre>
          <h3 style={{ color: '#a21caf', fontWeight: 600, fontSize: 20, marginTop: 24 }}>Messages</h3>
          <pre style={{ background: '#f3f3f3', borderRadius: 8, padding: 18, fontSize: 14, maxHeight: 250, overflow: 'auto' }}>{JSON.stringify(messages, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 