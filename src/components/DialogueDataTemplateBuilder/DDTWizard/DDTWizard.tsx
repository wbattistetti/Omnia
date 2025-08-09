import React, { useState, useEffect, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import MainDataCollection, { SchemaNode } from './MainDataCollection';
import { computeWorkPlan } from './workPlan';
import { runPlanCollect, PlanRunResult } from './planRunner';
import { buildArtifactStore } from './artifactStore';
import { assembleFinalDDT } from './assembleFinal';
import ResponseEditor from '../../ActEditor/ResponseEditor';

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
  const [dataNode] = useState<DataNode | null>(null);
  const [closed, setClosed] = useState(false);
  // removed unused refs

  // Schema editing state (from detect schema)
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>('');
  const [schemaMains, setSchemaMains] = useState<SchemaNode[]>([]);
  const [, setArtifacts] = useState<PlanRunResult[] | null>(null);
  const [assembled, setAssembled] = useState<any | null>(null);
  const [showEditor, setShowEditor] = useState(false);

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
        const root = schema.label || 'Data';
        const mains0: SchemaNode[] = (schema.mainData || []).map((m: any) => ({
          label: m.label || m.name || 'Field',
          type: m.type,
          icon: m.icon,
          subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({ label: s.label || s.name || 'Field', type: s.type, icon: s.icon })) : [],
        }));
        setDetectTypeIcon(ai.icon || null);
        // Enrich constraints immediately, then show structure step
        const enrichedRes = await enrichConstraintsFor(root, mains0);
        setSchemaRootLabel((enrichedRes && enrichedRes.label) ? enrichedRes.label : root);
        setSchemaMains((enrichedRes && enrichedRes.mains) ? enrichedRes.mains : mains0);
        setStep('structure');
        return;
      }
      throw new Error('Schema non valido');
    } catch (err: any) {
      setErrorMsg('Errore IA: ' + (err.message || ''));
      setStep('error');
    }
  };

  // removed old continue

  const enrichConstraintsFor = async (rootLabelIn: string, mainsIn: SchemaNode[]) => {
    try {
      const schema = { label: rootLabelIn || 'Data', mains: mainsIn.map((m) => ({ label: m.label, type: m.type, icon: m.icon, subData: (m.subData || []).map(s => ({ label: s.label, type: s.type, icon: s.icon })) })) };
      const res = await fetch(`${API_BASE}/step3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schema),
      });
      if (!res.ok) return;
      const result = await res.json();
      console.log('[constraints] raw result', result);
      const enriched: any = (result && result.ai && result.ai.schema) ? result.ai.schema : {};
      console.log('[constraints] enriched schema', enriched);
      if (!!enriched && typeof enriched === 'object' && Array.isArray((enriched as any).mainData)) {
        const norm = (v: any) => (v || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
        const enrichedMap = new Map<string, any>();
        for (const m of (enriched as any).mainData) enrichedMap.set(norm(m.label), m);
        const nextMains = mainsIn.map((existing) => {
          const em = enrichedMap.get(norm(existing.label));
          let nextSub = existing.subData || [];
          if (em && Array.isArray(em.subData) && nextSub.length > 0) {
            const subMap = new Map<string, any>();
            for (const s of em.subData) subMap.set(norm(s.label), s);
            nextSub = nextSub.map((sub) => {
              const es = subMap.get(norm(sub.label));
              return { ...sub, constraints: es?.constraints || sub.constraints };
            });
          }
          return { ...existing, constraints: em?.constraints || existing.constraints, subData: nextSub };
        });
        return { label: ((enriched as any).label || rootLabelIn) as string, mains: nextMains };
      }
      return { label: rootLabelIn, mains: mainsIn };
    } catch (e) {
      // ignore constraints errors for now
      console.error('[constraints] error fetching constraints', e);
      return { label: rootLabelIn, mains: mainsIn };
    }
  };

  // fetchConstraints no longer used in structure step

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
    const wp = computeWorkPlan(schemaMains, { stepsPerConstraint: 3 });
    return (
      <div style={{ padding: 16 }}>
        <MainDataCollection
          rootLabel={schemaRootLabel || 'Data'}
          mains={schemaMains}
          onChangeMains={setSchemaMains}
          onAddMain={handleAddMain}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('input')} style={{ background: 'transparent', color: '#fb923c', border: '1px solid #7c2d12', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => handleClose()} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={async () => {
                // Continue: run plan collect, assemble, open editor (no alerts)
                const r = await runPlanCollect(schemaMains);
                setArtifacts(r);
                const store = buildArtifactStore(r);
                const finalDDT = assembleFinalDDT(schemaRootLabel || 'Data', schemaMains, store);
                setAssembled(finalDDT);
                setShowEditor(true);
              }}
              style={{ background: '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}
            >
              Continue
            </button>
          </div>
        </div>
        {showEditor && assembled && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(2,6,23,0.7)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                width: '92%',
                maxWidth: 1200,
                maxHeight: '90vh',
                background: '#0b1220',
                border: '1px solid #475569',
                borderRadius: 12,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #334155', background: '#0f172a' }}>
                <div style={{ color: '#e2e8f0', fontWeight: 700 }}>Response Editor (preview)</div>
                <button onClick={() => setShowEditor(false)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Close</button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', background: '#0b1220' }}>
                <ResponseEditor ddt={assembled} />
              </div>
            </div>
          </div>
        )}
        {/* debug removed */}
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