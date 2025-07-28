import React, { useState } from 'react';
import { assignGuidsToConstraints, DataField, Constraint } from './assignGuidsToConstraints';
import { generateRuntimeKeys } from './generateRuntimeKeys';
import { ParallelStepWizard, Subtask } from './ParallelStepWizard';

// Funzione per fetch reale struttura dati dal backend/AI
async function fetchDataFieldFromAI(userDesc: string): Promise<DataField> {
  const res = await fetch('/step3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meaning: userDesc, desc: '' })
  });
  const data = await res.json();
  return data.ai.mainData;
}

// Funzione per fetch reale messaggio per una runtimeKey
async function fetchMessageForRuntimeKey(ddt_structure: DataField, runtimeKey: string): Promise<string> {
  const res = await fetch('/step4', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ddt_structure, runtimeKey })
  });
  const data = await res.json();
  return data.ai && data.ai[runtimeKey] ? data.ai[runtimeKey] : '';
}

// Funzione per fetch reale script per un constraint
async function fetchScriptForConstraint(constraint: Constraint): Promise<any> {
  const res = await fetch('/step5', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(constraint)
  });
  const data = await res.json();
  return data.ai || {};
}

// Utility per raccogliere tutti i constraint ricorsivamente
function collectAllConstraints(field: DataField): Constraint[] {
  let all: Constraint[] = [...(field.constraints || [])];
  for (const sub of field.subData || []) {
    all = all.concat(collectAllConstraints(sub));
  }
  return all;
}

const steps = [
  'Fetch struttura dati reale',
  'Assegnazione GUID',
  'Generazione runtimeKey',
  'Generazione messaggi parallela',
  'Generazione script parallela',
  'Completato'
];

const OrchestratorExample: React.FC = () => {
  const [step, setStep] = useState(0);
  const [enriched, setEnriched] = useState<DataField | null>(null);
  const [runtimeKeys, setRuntimeKeys] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messagesMap, setMessagesMap] = useState<Record<string, string>>({});
  const [scriptsMap, setScriptsMap] = useState<Record<string, any>>({});

  // Step 0: Fetch struttura dati reale
  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const dataField = await fetchDataFieldFromAI('birthdate');
      setEnriched(null); // reset
      setRuntimeKeys([]);
      setCompleted(false);
      setMessagesMap({});
      setScriptsMap({});
      setEnriched(assignGuidsToConstraints(dataField));
      setStep(1);
    } catch (e) {
      setError('Errore nel fetch struttura dati');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Assegna GUID (già fatto in handleFetch)
  const handleAssignGuids = () => {
    setStep(2);
  };

  // Step 2: Genera runtimeKey
  const handleGenerateKeys = () => {
    if (!enriched) return;
    const ddtId = enriched.id || 'Birthdate';
    const messages = generateRuntimeKeys(enriched, { ddtId });
    setRuntimeKeys(Object.keys(messages));
    setStep(3);
  };

  // Step 3: Generazione parallela messaggi (fetch reale)
  const subtasksMessages: Subtask[] = runtimeKeys.map((runtimeKey) => ({
    id: runtimeKey,
    label: runtimeKey,
    run: async () => {
      if (!enriched) return;
      const msg = await fetchMessageForRuntimeKey(enriched, runtimeKey);
      setMessagesMap(prev => ({ ...prev, [runtimeKey]: msg }));
    }
  }));

  // Step 4: Generazione parallela script per ogni constraint
  const allConstraints = enriched ? collectAllConstraints(enriched) : [];
  const subtasksScripts: Subtask[] = allConstraints.map((constraint) => ({
    id: constraint.id || constraint.type,
    label: `${constraint.label} (${constraint.type})`,
    run: async () => {
      const script = await fetchScriptForConstraint(constraint);
      setScriptsMap(prev => ({ ...prev, [constraint.id || constraint.type]: script }));
    }
  }));

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px #0002', padding: 32 }}>
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Esempio Orchestrazione Step-by-Step</h2>
      <div style={{ marginBottom: 18 }}>
        <b>Step corrente:</b> {steps[step]}
      </div>
      {step === 0 && (
        <div>
          <button style={{ marginTop: 18 }} onClick={handleFetch} disabled={loading}>
            {loading ? 'Caricamento...' : 'Carica struttura dati reale'}
          </button>
          {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        </div>
      )}
      {step === 1 && enriched && (
        <div>
          <div>Assegna GUID ricorsivi a tutti i campi e constraint (già fatto).</div>
          <button style={{ marginTop: 18 }} onClick={handleAssignGuids}>Avanti: Genera runtimeKey</button>
        </div>
      )}
      {step === 2 && (
        <div>
          <div>Genera tutte le runtimeKey per i messaggi.</div>
          <button style={{ marginTop: 18 }} onClick={handleGenerateKeys}>Genera runtimeKey</button>
        </div>
      )}
      {step === 3 && (
        <div>
          <ParallelStepWizard
            title="Sto generando i messaggi per ogni step e constraint..."
            subtasks={subtasksMessages}
            onComplete={() => setStep(4)}
          />
        </div>
      )}
      {step === 4 && (
        <div>
          <ParallelStepWizard
            title="Sto generando gli script di validazione per ogni constraint..."
            subtasks={subtasksScripts}
            onComplete={() => { setCompleted(true); setStep(5); }}
          />
        </div>
      )}
      {step === 5 && completed && (
        <div style={{ color: '#059669', fontWeight: 600, fontSize: 18 }}>
          Tutti i messaggi e script generati! Pipeline completata 🎉
          <div style={{ marginTop: 24, background: '#f3f3f3', borderRadius: 8, padding: 16, fontSize: 15, maxHeight: 300, overflow: 'auto' }}>
            <b>Preview messaggi generati:</b>
            <pre style={{ marginTop: 8 }}>{JSON.stringify(messagesMap, null, 2)}</pre>
            <b style={{ marginTop: 16, display: 'block' }}>Preview script generati:</b>
            <pre style={{ marginTop: 8 }}>{JSON.stringify(scriptsMap, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrchestratorExample; 