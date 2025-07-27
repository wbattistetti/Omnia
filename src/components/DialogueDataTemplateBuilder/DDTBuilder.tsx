import React, { useState } from 'react';
import { DataNode } from './orchestrator/stepGenerator';
import { useOrchestrator } from './orchestrator/useOrchestrator';
import { assembleFinalDDT } from './orchestrator/assembleDDT';

// TODO: importa spinner, warning, icone, modale, ecc

// Spinner semplice
function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
      <div style={{ width: 32, height: 32, border: '4px solid #2563eb', borderTop: '4px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const WizardCard = ({
  userDesc, setUserDesc, handleStart, handleCancel, errorMsg
}: {
  userDesc: string;
  setUserDesc: (v: string) => void;
  handleStart: () => void;
  handleCancel: () => void;
  errorMsg: string | null;
}) => (
  <div
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 2,
      background: '#18181b',
      borderRadius: 16,
      border: '2.5px solid #a21caf',
      margin: '0 auto 16px auto',
      maxWidth: 420,
      boxShadow: '0 2px 16px #0008',
    }}
  >
    <div style={{ background: '#a21caf', padding: '18px 0 12px 0', textAlign: 'center' }}>
      <span style={{ color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: 0.5 }}>Create data template</span>
    </div>
    <div style={{ padding: '28px 32px 24px 32px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 2 }}>Che dato vuoi acquisire?</div>
      <div style={{ color: '#d1d5db', fontSize: 15, marginBottom: 18 }}>(es: data di nascita, email, ecc:)</div>
      {errorMsg && (
        <div style={{ color: '#f59e42', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
          {errorMsg}
        </div>
      )}
      <input
        type="text"
        value={userDesc}
        onChange={e => setUserDesc(e.target.value)}
        placeholder="data"
        style={{
          fontSize: 17,
          padding: '10px 16px',
          width: '100%',
          borderRadius: 8,
          border: '2px solid #a21caf',
          outline: 'none',
          marginBottom: 22,
          background: '#23232b',
          color: '#fff',
          boxSizing: 'border-box',
        }}
        onKeyDown={e => { if (e.key === 'Enter' && userDesc.trim()) handleStart(); }}
      />
      <div style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'flex-end', marginTop: 2 }}>
        <button
          onClick={handleCancel}
          style={{
            background: 'transparent',
            color: '#a21caf',
            border: 'none',
            borderRadius: 8,
            padding: '8px 24px',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Annulla
        </button>
        <button
          onClick={handleStart}
          style={{
            background: '#a21caf',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 24px',
            fontWeight: 600,
            fontSize: 16,
            cursor: userDesc.trim() ? 'pointer' : 'not-allowed',
            opacity: userDesc.trim() ? 1 : 0.6,
          }}
          disabled={!userDesc.trim()}
        >
          Invia
        </button>
      </div>
    </div>
  </div>
);

const DDTList = () => (
  <div
    style={{
      overflowY: 'auto',
      maxHeight: 220,
      padding: 8,
      marginTop: 0,
    }}
  >
    {/* Qui va la lista DDT vera e propria */}
    <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 12, color: '#fff' }}>Lista DDT (scrolla qui sotto)</div>
    <ul style={{ maxHeight: 180, overflowY: 'auto', paddingRight: 8 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid #333', color: '#fff' }}>DDT {i + 1}</li>
      ))}
    </ul>
  </div>
);

const DDTBuilder: React.FC = () => {
  // Stato input box iniziale
  const [userDesc, setUserDesc] = useState('');
  const [started, setStarted] = useState(false);
  const [dataNode, setDataNode] = useState<DataNode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Orchestratore (solo dopo invio)
  const orchestrator = dataNode ? useOrchestrator(dataNode) : null;

  // Stato JSON finale
  const [finalDDT, setFinalDDT] = useState<any>(null);

  // Handler invio input iniziale
  const handleStart = () => {
    if (!userDesc.trim()) return;
    // Simula errore demo (rimuovi se non serve)
    // setErrorMsg("Non ho capito cosa intendi. Che tipo di dato vuoi acquisire? Puoi riscrivere meglio?"); return;
    setErrorMsg(null);
    setDataNode({ name: userDesc });
    setStarted(true);
  };
  // Handler annulla
  const handleCancel = () => {
    setUserDesc('');
    setStarted(false);
    setDataNode(null);
    setFinalDDT(null);
    setErrorMsg(null);
  };

  // Handler fine orchestrazione
  React.useEffect(() => {
    if (
      orchestrator &&
      orchestrator.state.currentStepIndex >= orchestrator.state.steps.length &&
      !finalDDT
    ) {
      setFinalDDT(assembleFinalDDT(orchestrator.state.stepResults));
    }
  }, [orchestrator, finalDDT]);

  // Barra step e azioni errore
  const stepBar = orchestrator ? (
    <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
      {orchestrator.state.steps.map((step, idx) => (
        <div key={step.key} style={{
          padding: '4px 12px',
          borderRadius: 4,
          background: idx === orchestrator.state.currentStepIndex ? '#2563eb' : '#e0e7ef',
          color: idx === orchestrator.state.currentStepIndex ? '#fff' : '#222',
          fontWeight: idx === orchestrator.state.currentStepIndex ? 700 : 400,
          border: idx === orchestrator.state.currentStepIndex ? '2px solid #2563eb' : '1px solid #cbd5e1',
          fontSize: 14
        }}>{step.label}</div>
      ))}
      {orchestrator.state.stepLoading && <Spinner />}
    </div>
  ) : null;

  // Warning di errore
  const errorActions = orchestrator && orchestrator.state.stepError ? (
    <div style={{ background: '#fee2e2', color: '#b91c1c', padding: 12, borderRadius: 4, marginBottom: 12, border: '1px solid #fca5a5' }}>
      <b>Errore durante la generazione dello step!</b>
      <div style={{ marginTop: 4 }}>{orchestrator.state.lastError?.message || 'Errore sconosciuto.'}</div>
      <button
        style={{ marginTop: 8, padding: '6px 16px', borderRadius: 4, background: '#b91c1c', color: '#fff', border: 'none', fontWeight: 600 }}
        onClick={orchestrator.retry}
      >
        Riprova step
      </button>
    </div>
  ) : null;

  // Modale debug
  const debugModal = orchestrator && orchestrator.debugModal ? (
    <div className="modal-debug" style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #888', borderRadius: 8, padding: 24, zIndex: 1000 }}>
      <h3 style={{ marginBottom: 8 }}>Result from {orchestrator.debugModal.step.label}</h3>
      <pre style={{ maxHeight: 300, overflow: 'auto', background: '#f3f3f3', padding: 12, borderRadius: 4 }}>{JSON.stringify(orchestrator.debugModal.result.payload, null, 2)}</pre>
      <button onClick={orchestrator.closeDebugModalAndContinue} style={{ marginTop: 12 }}>OK</button>
    </div>
  ) : null;

  // Funzione di export legacy per scaricare un file JSON
  function downloadJSON(data: any, filename = 'ddt.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Preview/export JSON finale
  const previewBox = finalDDT ? (
    <div style={{ marginTop: 24 }}>
      <h3>DDT JSON Preview</h3>
      <pre style={{ background: '#f3f3f3', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(finalDDT, null, 2)}</pre>
      <button
        style={{ marginTop: 12, padding: '8px 16px', borderRadius: 4, background: '#059669', color: '#fff', border: 'none', fontWeight: 600 }}
        onClick={() => downloadJSON(finalDDT)}
      >
        Export JSON
      </button>
    </div>
  ) : null;

  // In Accordion:
  return (
    <>
      <WizardCard
        userDesc={userDesc}
        setUserDesc={setUserDesc}
        handleStart={handleStart}
        handleCancel={handleCancel}
        errorMsg={errorMsg}
      />
      <DDTList />
    </>
  );
};

export default DDTBuilder; 