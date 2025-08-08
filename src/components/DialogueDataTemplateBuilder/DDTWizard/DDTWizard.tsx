import React, { useState, useEffect, useRef, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import MainDataCollection, { SchemaNode } from './MainDataCollection';
import { computeWorkPlan } from './workPlan';
import { buildStepPlan } from './stepPlan';
import { runPlanDry, runPlanCollect, PlanRunResult } from './planRunner';
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
  const [dataNode, setDataNode] = useState<DataNode | null>(null);
  const [closed, setClosed] = useState(false);
  const dataNodeSet = useRef(false);

  // Schema editing state (from detect schema)
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>('');
  const [schemaMains, setSchemaMains] = useState<SchemaNode[]>([]);
  const [collectCount, setCollectCount] = useState<number | null>(null);
  const [artifacts, setArtifacts] = useState<PlanRunResult[] | null>(null);
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

  const handleStructureContinue = () => {
    // Only fetch constraints and enrich the current structure view. Do not advance.
    fetchConstraints();
  };

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

  const fetchConstraints = async () => {
    const enrichedRes = await enrichConstraintsFor(schemaRootLabel || 'Data', schemaMains);
    if (enrichedRes) {
      setSchemaRootLabel(enrichedRes.label);
      setSchemaMains(enrichedRes.mains);
    }
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
    const wp = computeWorkPlan(schemaMains, { stepsPerConstraint: 3 });
    const preview = buildStepPlan(schemaMains);
    return (
      <div style={{ padding: 16 }}>
        <MainDataCollection
          rootLabel={schemaRootLabel || 'Data'}
          mains={schemaMains}
          onChangeMains={setSchemaMains}
          onAddMain={handleAddMain}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <div style={{ color: '#94a3b8' }}>
            Total steps: <span style={{ color: '#fb923c', fontWeight: 700 }}>{wp.total}</span> (data: {wp.numData}, constraints: {wp.numConstraints})
          </div>
          <button onClick={() => setStep('input')} style={{ background: 'transparent', color: '#fb923c', border: '1px solid #7c2d12', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Back</button>
          <button onClick={handleStructureContinue} style={{ background: '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Suggest validation rules</button>
          <button onClick={() => handleClose()} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => runPlanDry(schemaMains)} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Run plan (dry)</button>
          <button onClick={async () => { const r = await runPlanCollect(schemaMains); setArtifacts(r); setCollectCount(r.length); console.log('[planRunner] collected', r); alert(`Collected ${r.length} step results. Check console.`); }} style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Run plan (collect)</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              try {
                if (!artifacts) return;
                const store = buildArtifactStore(artifacts);
                const finalDDT = assembleFinalDDT(schemaRootLabel || 'Data', schemaMains, store);
                setAssembled(finalDDT);
                console.log('[DDT Assembler] final', finalDDT);
                alert('DDT assembled. Check console.');
              } catch (e) {
                console.error('Assemble error', e);
                alert('Assemble error, see console');
              }
            }}
            disabled={!artifacts}
            style={{ background: artifacts ? '#fb923c' : '#334155', color: artifacts ? '#0b1220' : '#94a3b8', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: artifacts ? 'pointer' : 'not-allowed' }}
          >
            Assemble DDT
          </button>
          <button
            onClick={() => setShowEditor(true)}
            disabled={!assembled}
            style={{ background: assembled ? '#fb923c' : '#334155', color: assembled ? '#0b1220' : '#94a3b8', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: assembled ? 'pointer' : 'not-allowed' }}
          >
            Open in Response Editor
          </button>
          <button
            onClick={() => {
              if (!assembled) return;
              const save = (filename: string, data: any) => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              };
              save(`${(assembled.label || 'DDT').replace(/\s+/g, '_')}.json`, assembled);
              save(`${(assembled.label || 'DDT').replace(/\s+/g, '_')}.translations.en.json`, assembled.translations?.en || {});
            }}
            disabled={!assembled}
            style={{ background: assembled ? '#fb923c' : '#334155', color: assembled ? '#0b1220' : '#94a3b8', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: assembled ? 'pointer' : 'not-allowed' }}
          >
            Export JSON
          </button>
        </div>
        {artifacts && (
          <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>Artifacts ready for assemble.</div>
        )}
        {showEditor && assembled && (
          <div style={{ marginTop: 12, border: '1px solid #475569', borderRadius: 8, overflow: 'hidden' }}>
            <ResponseEditor ddt={assembled} />
          </div>
        )}
        <div style={{ marginTop: 8, color: '#94a3b8', fontSize: 12 }}>
          Preview sequence (first 20): {preview.slice(0, 20).map(p => `${p.path}·${p.type}`).join('  |  ')}
          {collectCount !== null && (
            <span style={{ marginLeft: 12 }}>Collected: <span style={{ color: '#fb923c' }}>{collectCount}</span></span>
          )}
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