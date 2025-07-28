import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DataNode } from './orchestrator/stepGenerator';
import { useOrchestrator } from './orchestrator/useOrchestrator';
import { assembleFinalDDT } from './orchestrator/assembleDDT';
import { useProjectData } from '../../context/ProjectDataContext';
import { getAllDialogueTemplates } from '../../services/ProjectDataService';
import { Settings, Trash2, Calendar } from 'lucide-react';
import { SIDEBAR_TYPE_COLORS } from '../Sidebar/sidebarTheme';

// TODO: importa spinner, warning, icone, modale, ecc

// Spinner clessidra panciuta blu
function HourglassSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '24px 0' }}>
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ animation: 'spin 1.2s linear infinite' }}>
        <g>
          <ellipse cx="18" cy="7" rx="7" ry="4" fill="#2563eb" />
          <ellipse cx="18" cy="29" rx="7" ry="4" fill="#2563eb" />
          <path d="M11 11 Q18 18 11 25" stroke="#2563eb" strokeWidth="2.8" fill="none" />
          <path d="M25 11 Q18 18 25 25" stroke="#2563eb" strokeWidth="2.8" fill="none" />
          <ellipse cx="18" cy="18" rx="2.5" ry="1.2" fill="#2563eb" />
          <rect x="17.2" y="12" width="1.6" height="12" rx="0.8" fill="#2563eb" />
        </g>
      </svg>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const WizardCard = ({
  userDesc, setUserDesc, handleStart, handleCancel, errorMsg, stepMessage, stepLoading, stepError, onRetry, stepDone
}: {
  userDesc: string;
  setUserDesc: (v: string) => void;
  handleStart: () => void;
  handleCancel: () => void;
  errorMsg: string | null;
  stepMessage?: string | null;
  stepLoading?: boolean;
  stepError?: string | null;
  onRetry?: () => void;
  stepDone?: boolean;
}) => (
  <div
    style={{
      position: 'sticky',
      top: 0,
      zIndex: 2,
      background: '#18181b',
      borderRadius: 16,
      border: '2.5px solid #a21caf',
      margin: '0 12px 16px 12px',
      width: 'calc(100% - 24px)',
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
      {/* Label step SEMPRE visibile durante la pipeline, sparisce solo a ciclo completato */}
      {!stepDone && (
        <div style={{
          color: stepError ? '#dc2626' : '#2563eb',
          background: stepError ? 'rgba(220,38,38,0.12)' : 'rgba(37,99,235,0.12)', // trasparente reale
          borderRadius: 6,
          padding: '10px 18px',
          margin: '0 0 18px 0',
          fontWeight: 600,
          fontSize: 17,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          height: 64, // altezza fissa sufficiente per clessidra e due righe
          minHeight: 64,
          lineHeight: 1.3,
          transition: 'background 0.2s, color 0.2s'
        }}>
          <div style={{ width: 40, minWidth: 40, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            {stepLoading && !stepError && <HourglassSpinner />}
          </div>
          <span style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'pre-line' }}>
            {stepMessage}
            {!stepError && stepLoading && <AnimatedDots />}
            {stepError && (
              <>
                <span style={{ marginLeft: 8 }}>{stepError}</span>
              </>
            )}
          </span>
        </div>
      )}
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

const DDTList = ({ ddtItems, loading, error }: { ddtItems: { id: string; name: string }[], loading: boolean, error: string | null }) => {
  const violet = SIDEBAR_TYPE_COLORS.agentActs.main;
  return (
    <div
      style={{
        maxHeight: 300,
        overflowY: 'auto',
        padding: 0,
        marginTop: 0,
        background: 'transparent',
        borderRadius: 12,
      }}
    >
      {loading ? (
        <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>Caricamento...</div>
      ) : error ? (
        <div style={{ color: '#f87171', fontStyle: 'italic', textAlign: 'center', padding: 16 }}>{error}</div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ddtItems.length === 0 ? (
            <li style={{ color: '#888', fontStyle: 'italic', padding: 16 }}>Nessun DDT presente</li>
          ) : (
            ddtItems.map(item => (
              <li
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#18181b',
                  borderRadius: 10,
                  margin: '8px 8px',
                  padding: '10px 16px',
                  color: violet,
                  fontWeight: 600,
                  fontSize: 16,
                  boxShadow: '0 2px 8px #0002',
                  gap: 12,
                }}
              >
                <Calendar size={20} style={{ marginRight: 8, flexShrink: 0, color: violet }} />
                <span style={{ flex: 1, color: violet }}>{item.name}</span>
                <button
                  style={{ background: 'none', border: 'none', color: violet, marginRight: 8, cursor: 'pointer', padding: 4, borderRadius: 4, transition: 'background 0.2s' }}
                  title="Impostazioni"
                  onClick={() => alert(`Azione impostazioni per ${item.name}`)}
                >
                  <Settings size={18} />
                </button>
                <button
                  style={{ background: 'none', border: 'none', color: violet, cursor: 'pointer', padding: 4, borderRadius: 4, transition: 'background 0.2s' }}
                  title="Elimina"
                  onClick={() => alert(`Azione elimina per ${item.name}`)}
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

interface DDTBuilderProps {
  onCancel?: () => void;
  onComplete?: (newDDT: any, messages?: any) => void;
}

function OrchestratorRunner({ dataNode, onComplete, onCancel, onStepState }: { dataNode: DataNode; onComplete: (newDDT: any, messages?: any) => void; onCancel: () => void; onStepState: (msg: string | null, loading: boolean, error: string | null, retryFn?: () => void) => void }) {
  console.log('[DEBUG] OrchestratorRunner MOUNT', { dataNode });
  useEffect(() => {
    return () => {
      console.log('[OrchestratorRunner] UNMOUNT', { dataNode });
    };
  }, []);
  const orchestrator = useOrchestrator(dataNode);

  // Stato DDT list
  const [ddtList, setDdtList] = useState<{ id: string, name: string }[]>([]);
  const [loadingDDT, setLoadingDDT] = useState(true);
  const [errorDDT, setErrorDDT] = useState<string | null>(null);

  // Stato JSON finale
  const [finalDDT, setFinalDDT] = useState<any>(null);

  // Avvia il primo step solo al mount
  useEffect(() => {
    console.log('[DEBUG] mount: runNextStep');
    orchestrator.runNextStep();
  }, []);

  // Quando debugModal è presente (step completato), chiudi la modale e avanza l'indice
  useEffect(() => {
    console.log('[DEBUG] debugModal:', orchestrator.debugModal);
    if (orchestrator.debugModal) {
      setTimeout(() => {
        console.log('[DEBUG] closeDebugModalAndContinue');
        orchestrator.closeDebugModalAndContinue();
      }, 400);
    }
  }, [orchestrator.debugModal]);

  // Quando currentStepIndex cambia, avvia il prossimo step se non siamo alla fine e non c'è errore/loading
  useEffect(() => {
    console.log('[DEBUG] currentStepIndex:', orchestrator.state.currentStepIndex, 'stepLoading:', orchestrator.state.stepLoading, 'stepError:', orchestrator.state.stepError);
    if (
      orchestrator.state.currentStepIndex < orchestrator.state.steps.length &&
      !orchestrator.state.stepLoading &&
      !orchestrator.state.stepError
    ) {
      console.log('[DEBUG] runNextStep (currentStepIndex effect)');
      orchestrator.runNextStep();
    }
  }, [orchestrator.state.currentStepIndex]);

  // Aggiorna la UI step corrente su ogni cambiamento di stato
  useEffect(() => {
    const idx = orchestrator.state.currentStepIndex;
    const step = orchestrator.state.steps[idx];
    console.log('[DEBUG] UI step:', idx, step?.label, orchestrator.state.stepLoading, orchestrator.state.stepError);
    if (step && onStepState) {
      onStepState(
        step.label,
        orchestrator.state.stepLoading,
        orchestrator.state.stepError ? "C'è un errore di comunicazione" : null,
        orchestrator.retry
      );
    }
  }, [orchestrator.state.currentStepIndex, orchestrator.state.stepLoading, orchestrator.state.stepError]);

  // Handler fine orchestrazione
  React.useEffect(() => {
    console.log('[DEBUG] orchestrator state:', orchestrator?.state);
    if (
      orchestrator &&
      orchestrator.state.currentStepIndex >= orchestrator.state.steps.length &&
      !finalDDT
    ) {
      console.log('[DEBUG] Chiamo assembleFinalDDT', orchestrator.state.stepResults);
      const final = assembleFinalDDT(orchestrator.state.stepResults);
      console.log('[DEBUG] Risultato assembleFinalDDT', final);
      setFinalDDT(final);
      if (onComplete) onComplete(final.structure, final.translations);
    }
  }, [orchestrator, finalDDT]);

  // Effetto per caricare la lista DDT
  useEffect(() => {
    setLoadingDDT(true);
    setErrorDDT(null);
    getAllDialogueTemplates()
      .then(list => {
        setDdtList(list.map((ddt: any) => ({
          id: ddt.id,
          name: ddt.name || ddt.label || 'Unnamed'
        })));
      })
      .catch(() => setErrorDDT('Errore nel caricamento DDT'))
      .finally(() => setLoadingDDT(false));
  }, []);

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

  const { data: projectData } = useProjectData();
  // Prendi la lista DDT reale (esempio: tasks, oppure cambia con la categoria corretta)
  // const ddtItems = (projectData?.tasks?.flatMap(cat => cat.items) ?? []).map(item => ({ id: item.id, name: item.name }));

  // Rimuovi openWizardButton e la sua logica

  // In Accordion:
  return (
    <div>
      {/* Modale risultato step */}
      {/* Modale preview step-by-step */}
      {/* StepBar, errorActions, previewBox solo se dataNode */}
      {dataNode && (
        <>
      {/* errorActions */}
      {/* debugModal */}
      {previewBox}
        </>
      )}
    </div>
  );
}

const DDTBuilder: React.FC<DDTBuilderProps> = ({ onCancel, onComplete }) => {
  // Stato input box iniziale
  const [userDesc, setUserDesc] = useState('');
  const [started, setStarted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Stato per step wizard
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [onRetry, setOnRetry] = useState<(() => void) | undefined>(undefined);
  const [stepDone, setStepDone] = useState(false); // Aggiunto per controllare quando il ciclo è completato

  // Usa useMemo per evitare nuovi oggetti ad ogni render
  const dataNode = useMemo(() => {
    if (!userDesc.trim()) return null;
    return { name: userDesc.trim() };
  }, [userDesc]);

  // Handler invio input iniziale
  const handleStart = () => {
    if (!userDesc.trim()) return;
    setErrorMsg(null);
    setStarted(true);
  };
  // Handler annulla
  const handleCancel = () => {
    setUserDesc('');
    setStarted(false);
    setErrorMsg(null);
    setStepMessage(null);
    setStepLoading(false);
    setStepError(null);
    setOnRetry(undefined);
    setStepDone(false); // Resetta lo stato del ciclo
    if (onCancel) onCancel();
  };

  // Handler per ricevere stato step dal runner
  const handleStepState = (msg: string | null, loading: boolean, error: string | null, retryFn?: () => void) => {
    setStepMessage(msg);
    setStepLoading(loading);
    setStepError(error);
    setOnRetry(() => retryFn);
  };

  // Effetto per controllare quando il ciclo è completato
  useEffect(() => {
    if (stepLoading === false && stepError === null && stepMessage === null) {
      setStepDone(true);
    } else {
      setStepDone(false);
    }
  }, [stepLoading, stepError, stepMessage]);

  return (
    <div>
      <WizardCard
        userDesc={userDesc}
        setUserDesc={setUserDesc}
        handleStart={handleStart}
        handleCancel={handleCancel}
        errorMsg={errorMsg}
        stepMessage={stepMessage}
        stepLoading={stepLoading}
        stepError={stepError}
        onRetry={onRetry}
        stepDone={stepDone}
      />
      {/* Monta l'orchestratore solo quando l'utente ha premuto Invia */}
      {started && dataNode && dataNode.name && (
        <OrchestratorRunner
          dataNode={dataNode as DataNode}
          onComplete={onComplete || (() => {})}
          onCancel={onCancel || (() => {})}
          onStepState={handleStepState}
        />
      )}
    </div>
  );
};

export default DDTBuilder; 

// AnimatedDots component
function AnimatedDots() {
  return <span style={{ display: 'inline-block', minWidth: 24 }}><span className="dot1">.</span><span className="dot2">.</span><span className="dot3">.</span><style>{`
    .dot1, .dot2, .dot3 { opacity: 0.3; animation: blink 1.4s infinite both; }
    .dot2 { animation-delay: .2s; }
    .dot3 { animation-delay: .4s; }
    @keyframes blink { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
  `}</style></span>;
} 