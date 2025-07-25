import React, { useState } from 'react';
import { Constraint } from './types';
import ConstraintMonacoEditor from './ConstraintMonacoEditor';
import ConstraintTestTable from './ConstraintTestTable';
import { generateConstraint } from './ConstraintAPI';

interface ConstraintWizardProps {
  variable: string;
  type: string;
  onSave: (constraint: Constraint) => void;
  onCancel?: () => void;
}

const ConstraintWizard: React.FC<ConstraintWizardProps> = ({ variable, type, onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [constraint, setConstraint] = useState<Constraint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: chat box per descrizione constraint
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const c = await generateConstraint(description, variable, type);
      setConstraint(c);
      setStep(2);
    } catch (e: any) {
      setError(e.message || 'Errore generazione constraint');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: modifica script/test case, conferma
  function handleScriptChange(newScript: string) {
    if (!constraint) return;
    setConstraint({ ...constraint, script: newScript });
  }
  function handleTestCasesChange(newTestCases: any) {
    if (!constraint) return;
    setConstraint({ ...constraint, testCases: newTestCases });
  }

  return (
    <div style={{ maxWidth: 540, margin: '0 auto', background: '#18181b', borderRadius: 12, padding: 24, boxShadow: '0 4px 32px #0008' }}>
      {step === 1 && (
        <>
          <div style={{ marginBottom: 12, color: '#fff' }}>Che vincolo vuoi applicare?</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Es: Deve essere una data nel passato, Deve essere un numero positivo, ..."
            style={{ width: '100%', minHeight: 60, borderRadius: 8, border: '1px solid #888', padding: 10, fontSize: 15, marginBottom: 12 }}
          />
          {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
            {onCancel && (
              <button
                onClick={onCancel}
                style={{
                  background: 'none',
                  color: '#fff',
                  border: 'none',
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Annulla
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={loading || !description.trim()}
              style={{
                background: '#a21caf',
                color: '#fff',
                fontWeight: 700,
                border: 'none',
                borderRadius: 8,
                padding: '10px 28px',
                fontSize: 16,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Generazione in corso...' : 'Genera constraint'}
            </button>
          </div>
        </>
      )}
      {step === 2 && constraint && (
        <>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Anteprima constraint</h2>
          <div style={{ color: '#fff', marginBottom: 8 }}><b>{constraint.title}</b></div>
          <div style={{ color: '#cbd5e1', marginBottom: 8 }}>{constraint.explanation}</div>
          <div style={{ color: '#fff', marginBottom: 8 }}>Script di validazione:</div>
          <ConstraintMonacoEditor script={constraint.script} onChange={handleScriptChange} />
          <div style={{ color: '#fff', marginBottom: 8 }}>Messaggi di errore:</div>
          <ul style={{ color: '#fbbf24', marginBottom: 8 }}>
            {constraint.messages.map((msg, i) => <li key={i}>{msg}</li>)}
          </ul>
          <div style={{ color: '#fff', marginBottom: 8 }}>Test automatici:</div>
          <ConstraintTestTable
            script={constraint.script}
            variable={constraint.variable}
            type={constraint.type}
            testCases={constraint.testCases}
            onChange={handleTestCasesChange}
          />
          <div style={{ marginTop: 18 }}>
            <button onClick={() => onSave(constraint)} style={{ background: '#22c55e', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 16, marginRight: 12 }}>Salva constraint</button>
            <button onClick={() => setStep(1)} style={{ background: 'none', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer' }}>Indietro</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ConstraintWizard; 