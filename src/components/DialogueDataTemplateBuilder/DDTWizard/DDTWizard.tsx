import React, { useState, useEffect, useRef, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import MainDataCollection, { SchemaNode } from './MainDataCollection';

// Tipo per dataNode
interface DataNode {
  name: string;
  subData?: string[];
}

const DDTWizard: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void }> = ({ onCancel, onComplete }) => {
  const API_BASE = (import.meta as any)?.env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
  const [step, setStep] = useState<string>('input');
  const [userDesc, setUserDesc] = useState('');
  const [detectTypeIcon, setDetectTypeIcon] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataNode, setDataNode] = useState<DataNode | null>(null);
  const [closed, setClosed] = useState(false);
  const dataNodeSet = useRef(false);

  // Schema editing state (from detect schema)
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>('');
  const [schemaMains, setSchemaMains] = useState<SchemaNode[]>([]);

  // Memo per dataNode stabile
  const stableDataNode = useMemo(() => dataNode, [dataNode]);

  useEffect(() => {
    return () => {
    };
  }, []);

  // Funzione per chiamare la detection AI
  const handleDetectType = async () => {
    if (step === 'pipeline' || closed) return; // Blocca ogni setState durante la pipeline
    setStep('loading');
    setErrorMsg(null);
      try {
        const res = await fetch(`${API_BASE}/step2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userDesc.trim()),
      });
      if (!res.ok) throw new Error('Errore comunicazione IA');
      const result = await res.json();
      const ai = result.ai || result;
      const schema = ai.schema;
      if (schema && Array.isArray(schema.mainData)) {
        setDetectTypeIcon(ai.icon || null);
        setSchemaRootLabel(schema.label || 'Data');
        setSchemaMains((schema.mainData || []).map((m: any) => ({
          label: m.label || m.name || 'Field',
          type: m.type,
          icon: m.icon,
          subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({ label: s.label || s.name || 'Field', type: s.type, icon: s.icon })) : [],
        })));
        setStep('structure');
        return;
      }
      throw new Error('Schema non valido');
    } catch (err: any) {
      setErrorMsg('Errore IA: ' + (err.message || ''));
      setStep('error');
    }
  };

  const handleStructureContinue = () => {
    // For now, proceed with the first main only; future: iterate all mains
    const first = schemaMains[0];
    if (!first) return;
    const sub = Array.isArray(first.subData) ? first.subData.map(s => s.label) : undefined;
    setDataNode({ name: first.label, subData: sub });
    dataNodeSet.current = true;
    setStep('pipeline');
  };

  const handleAddMain = () => {
    setSchemaMains(prev => [...prev, { label: 'New main data', type: 'object', subData: [] }]);
  };

  // Handler per chiusura (annulla o completamento)
  const handleClose = (result?: any, messages?: any) => {
    setClosed(true);
    if (result && onComplete) onComplete(result, messages);
    else onCancel();
  };

  // Se chiuso, non renderizzare nulla
  if (closed) return null;

  // Durante la pipeline mostra SOLO la pipeline
  if (step === 'pipeline') {
    if (!stableDataNode) {
      return null;
    }
    return (
      <WizardPipelineStep
        key={`pipeline-${stableDataNode.name || 'unknown'}`}
        dataNode={stableDataNode}
        detectTypeIcon={detectTypeIcon}
        onCancel={() => handleClose()}
        onComplete={(finalDDT) => {
          // Propaga il DDT finale al genitore
          handleClose(finalDDT);
        }}
        skipDetectType={true}
        confirmedLabel={schemaRootLabel || ''}
      />
    );
  }

  // Struttura: editor dei main data (primo step dopo detect)
  if (step === 'structure') {
    return (
      <div style={{ padding: 16 }}>
        <MainDataCollection
          rootLabel={schemaRootLabel || 'Data'}
          mains={schemaMains}
          onChangeMains={setSchemaMains}
          onAddMain={handleAddMain}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => setStep('input')} style={{ background: 'transparent', color: '#a78bfa', border: '1px solid #4c1d95', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Back</button>
          <button onClick={handleStructureContinue} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Continue</button>
          <button onClick={() => handleClose()} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    );
  }

  if (step === 'input') {
    return <WizardInputStep 
      userDesc={userDesc} 
      setUserDesc={setUserDesc} 
      onNext={handleDetectType} 
      onCancel={() => handleClose()}
    />;
  }
  if (step === 'loading') {
    return <WizardLoadingStep />;
  }
  if (step === 'error') {
    return <WizardErrorStep errorMsg={errorMsg} onRetry={handleDetectType} onSupport={() => setStep('support')} onCancel={() => handleClose()} />;
  }
  if (step === 'support') {
    return <WizardSupportModal onOk={() => handleClose()} />;
  }
  return null;
};

export default DDTWizard;