import React, { useState, useEffect, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import MainDataCollection, { SchemaNode } from './MainDataCollection';
import { computeWorkPlan } from './workPlan';
import { buildStepPlan } from './stepPlan';
import { PlanRunResult } from './planRunner';
import { buildArtifactStore } from './artifactStore';
import { assembleFinalDDT } from './assembleFinal';
// ResponseEditor will be opened by sidebar after onComplete

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
  // removed local artifacts/editor state; we now rely on onComplete to open editor via sidebar
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressByPath, setProgressByPath] = useState<Record<string, number>>({});
  const [, setTotalByPath] = useState<Record<string, number>>({});
  const [rootProgress, setRootProgress] = useState<number>(0);

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
    computeWorkPlan(schemaMains, { stepsPerConstraint: 3 });
    return (
      <div style={{ padding: 16 }}>
        <MainDataCollection
          rootLabel={schemaRootLabel || 'Data'}
          mains={schemaMains}
          onChangeMains={setSchemaMains}
          onAddMain={handleAddMain}
          progressByPath={{ ...progressByPath, __root__: rootProgress }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('input')} style={{ background: 'transparent', color: '#fb923c', border: '1px solid #7c2d12', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => handleClose()} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={async () => {
                if (isProcessing) return;
                setIsProcessing(true);
                // Build plan and totals
                const plan = buildStepPlan(schemaMains);
                const total: Record<string, number> = {};
                const done: Record<string, number> = {};
                for (const s of plan) { total[s.path] = (total[s.path] || 0) + 1; }
                setTotalByPath(total);
                setProgressByPath({});

                const API_BASE = (import.meta as any)?.env?.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
                const results: PlanRunResult[] = [];

                const callStep = async (step: any) => {
                  // Resolve datum by path
                  const parts = step.path.split('/');
                  const norm = (s: string) => s.replace(/\//g, '-');
                  const findDatum = () => {
                    const main = schemaMains.find(m => norm(m.label) === parts[0]);
                    if (!main) return null;
                    if (parts.length === 1) return main;
                    const sub = (main.subData || []).find(s => norm(s.label) === parts[1]);
                    return sub || null;
                  };
                  const datum: any = findDatum();
                  if (!datum) return;

                  try {
                    if (step.type === 'constraintMessages') {
                      const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter((c: any) => c && c.kind !== 'required') };
                      const res = await fetch(`${API_BASE}/api/constraintMessages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                      results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
                    } else if (step.type === 'validator') {
                      const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter((c: any) => c && c.kind !== 'required') };
                      const res = await fetch(`${API_BASE}/api/validator`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                      results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
                    } else if (step.type === 'testset') {
                      const datumBody = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter((c: any) => c && c.kind !== 'required') };
                      const res = await fetch(`${API_BASE}/api/testset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: datumBody, notes: [] }) });
                      results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
                    } else {
                      const meaning = parts[parts.length - 1];
                      let endpoint = '';
                      switch (step.type) {
                        case 'start': endpoint = '/api/startPrompt'; break;
                        case 'noMatch': endpoint = '/api/stepNoMatch'; break;
                        case 'noInput': endpoint = '/api/stepNoInput'; break;
                        case 'confirmation': endpoint = '/api/stepConfirmation'; break;
                        case 'success': endpoint = '/api/stepSuccess'; break;
                      }
                      if (endpoint) {
                        const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meaning, desc: '' }) });
                        results.push({ step: { path: step.path, type: step.type }, payload: await res.json() });
                      }
                    }
                  } finally {
                    done[step.path] = (done[step.path] || 0) + 1;
                    const nextProg: Record<string, number> = {};
                    for (const p of Object.keys(total)) nextProg[p] = (done[p] || 0) / (total[p] || 1);
                    setProgressByPath(nextProg);
                    const sumDone = Object.values(done).reduce((a, b) => a + (b || 0), 0);
                    const sumTotal = Object.values(total).reduce((a, b) => a + (b || 0), 0);
                    setRootProgress(sumTotal ? sumDone / sumTotal : 0);
                  }
                };

                for (const step of plan) {
                  // sequential to animate progress
                  /* eslint-disable no-await-in-loop */
                  await callStep(step);
                }

                setIsProcessing(false);
                const store = buildArtifactStore(results);
                const finalDDT = assembleFinalDDT(schemaRootLabel || 'Data', schemaMains, store);
                // chiudi wizard e notifica il parent per aggiornare lista e aprire editor
                if (onComplete) {
                  onComplete(finalDDT);
                }
                setClosed(true);
              }}
              disabled={isProcessing}
              style={{ background: isProcessing ? '#fbbf24' : '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: isProcessing ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {isProcessing && (<span className="spinner" style={{ width: 14, height: 14, border: '2px solid #0b1220', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />)}
              {isProcessing ? 'Processing…' : 'Continue'}
            </button>
          </div>
        </div>
        {/* editor modal removed: sidebar will open editor after onComplete */}
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