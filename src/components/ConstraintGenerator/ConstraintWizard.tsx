import React, { useState } from 'react';
import { Constraint } from './types';
import ConstraintMonacoEditor from './ConstraintMonacoEditor';
import ConstraintTestTable from './ConstraintTestTable';
import { generateConstraint } from './ConstraintAPI';
import { AlertTriangle, Pencil, Lock, Clock } from 'lucide-react';

interface ConstraintWizardProps {
  variable: string;
  type: string;
  onSave: (constraint: Constraint) => void;
  onCancel?: () => void;
}

const ConstraintWizard: React.FC<ConstraintWizardProps> = ({ variable, type, onSave, onCancel }) => {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [label, setLabel] = useState<string | null>(null); // etichetta generata
  const [constraint, setConstraint] = useState<Constraint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true); // true: mostra textarea, false: mostra etichetta

  // Mock IA generativa per label/etichetta (sostituire con vera IA)
  async function generateLabel(desc: string): Promise<string> {
    // Qui chiamerai la IA vera
    if (desc.toLowerCase().includes('passato')) return 'Il valore deve essere nel passato';
    if (desc.toLowerCase().includes('positivo')) return 'Il valore deve essere positivo';
    return 'Vincolo personalizzato';
  }

  // Step 1: descrizione + invio
  async function handleLabelSubmit() {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateLabel(description);
      setLabel(generated);
      setEditing(false);
    } catch (e: any) {
      setError('Errore generazione etichetta');
    } finally {
      setLoading(false);
    }
  }

  // Step 2: genera constraint vero
  async function handleGenerateConstraint() {
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

  // Icona vincolo (mock: clock per passato, lock per altro)
  function getConstraintIcon() {
    if (label && label.toLowerCase().includes('passato')) return <Clock size={18} style={{ color: '#fbbf24', marginRight: 6 }} />;
    return <Lock size={18} style={{ color: '#a21caf', marginRight: 6 }} />;
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#fafaff', borderRadius: 0, padding: 0, boxShadow: 'none' }}>
      {/* Step 1: descrizione + etichetta + invio */}
      {step === 1 && (
        <>
          <div style={{ marginBottom: 12, color: '#fff' }}>Che vincolo vuoi applicare?</div>
          {/* Etichetta generata + matita, oppure textarea */}
          {!editing && label && (
            <div style={{ display: 'flex', alignItems: 'center', background: '#23232b', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
              {getConstraintIcon()}
              <span style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>{label}</span>
              <Pencil size={16} style={{ marginLeft: 10, color: '#888', cursor: 'pointer' }} onClick={() => setEditing(true)} />
            </div>
          )}
          {editing && (
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Es: Deve essere una data nel passato, Deve essere un numero positivo, ..."
              style={{ width: '100%', minHeight: 60, borderRadius: 8, border: '1px solid #888', padding: 10, fontSize: 15, marginBottom: 12 }}
            />
          )}
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
            {/* Pulsante invia/genera constraint */}
            {!editing && label ? (
              <button
                onClick={handleGenerateConstraint}
                disabled={loading}
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
            ) : (
              <button
                onClick={handleLabelSubmit}
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
                {loading ? 'Generazione in corso...' : 'Invia'}
              </button>
            )}
          </div>
        </>
      )}
      {/* Step 2: mostra constraint generato e test */}
      {step === 2 && constraint && (
        <>
          {/* Titoli superflui rimossi */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#23232b', borderRadius: 8, padding: '8px 14px', marginBottom: 12 }}>
            {getConstraintIcon()}
            <span style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>{label}</span>
            <Pencil size={16} style={{ marginLeft: 10, color: '#888', cursor: 'pointer' }} onClick={() => { setStep(1); setEditing(true); }} />
          </div>
          <div style={{ color: '#fff', marginBottom: 8 }}>Script di validazione:</div>
          <div style={{ background: '#18181b', border: '1.5px solid #a21caf', borderRadius: 8, padding: 8, marginBottom: 16 }}>
            <ConstraintMonacoEditor script={constraint.script} onChange={handleScriptChange} />
          </div>
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
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {onCancel && (
              <button onClick={onCancel} style={{ background: 'none', color: '#a21caf', border: 'none', fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>
                Annulla
              </button>
            )}
            <button onClick={() => onSave(constraint)} style={{ background: '#22c55e', color: '#fff', fontWeight: 700, border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 16 }}>
              Salva constraint
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ConstraintWizard; 