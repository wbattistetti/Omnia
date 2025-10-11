import React, { useState, useEffect, useMemo } from 'react';
import WizardInputStep from './WizardInputStep';
import WizardLoadingStep from './WizardLoadingStep';
import WizardPipelineStep from './WizardPipelineStep';
import WizardErrorStep from './WizardErrorStep';
import WizardSupportModal from './WizardSupportModal';
import MainDataCollection, { SchemaNode } from './MainDataCollection';
import V2TogglePanel from './V2TogglePanel';
import { computeWorkPlan } from './workPlan';
import { buildStepPlan, buildPartialPlanForChanges } from './stepPlan';
import { PlanRunResult } from './planRunner';
import { buildArtifactStore, mergeArtifactStores, moveArtifactsPath } from './artifactStore';
import { assembleFinalDDT } from './assembleFinal';
import { Hourglass, Bell } from 'lucide-react';
// ResponseEditor will be opened by sidebar after onComplete

// Piccolo componente per i puntini animati
const AnimatedDots: React.FC<{ intervalMs?: number }> = ({ intervalMs = 450 }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c + 1) % 4), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return <span>{'.'.repeat(count)}</span>;
};

// Tipo per dataNode
interface DataNode {
  name: string;
  subData?: string[];
}

const DDTWizard: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean }> = ({ onCancel, onComplete, initialDDT, startOnStructure }) => {
  const API_BASE = '';
  // Ensure accent is inherited in nested components
  React.useEffect(() => {
    try {
      const el = document.querySelector('[data-ddt-section]') as HTMLElement | null;
      if (el) {
        const accent = getComputedStyle(el).getPropertyValue('--ddt-accent');
        if (accent) {
          (document.body.style as any).setProperty('--ddt-accent', accent.trim());
        }
      }
    } catch {}
  }, []);
  const [step, setStep] = useState<string>(startOnStructure ? 'structure' : 'input');
  const [userDesc, setUserDesc] = useState('');
  const [detectTypeIcon, setDetectTypeIcon] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataNode] = useState<DataNode | null>(null);
  const [closed, setClosed] = useState(false);
  // removed unused refs

  // Schema editing state (from detect schema)
  const [schemaRootLabel, setSchemaRootLabel] = useState<string>(initialDDT?.label || '');
  const [schemaMains, setSchemaMains] = useState<SchemaNode[]>(() => {
    if (initialDDT?.mainData && Array.isArray(initialDDT.mainData)) {
      return (initialDDT.mainData as any[]).map((m: any) => ({
        label: m.label,
        type: m.type,
        icon: m.icon,
        subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({ label: s.label, type: s.type, icon: s.icon, constraints: s.constraints })) : [],
        constraints: m.constraints
      })) as any;
    }
    return [];
  });
  // removed local artifacts/editor state; we now rely on onComplete to open editor via sidebar
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressByPath, setProgressByPath] = useState<Record<string, number>>({});
  const [, setTotalByPath] = useState<Record<string, number>>({});
  const [rootProgress, setRootProgress] = useState<number>(0);
  const [playChime, setPlayChime] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('ddtWizard.playChime');
      if (v === null) return true; // default true
      return v === '1';
    } catch {
      return true;
    }
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [autoEditIndex, setAutoEditIndex] = useState<number | null>(null);
  const [changes, setChanges] = useState<Record<string, Set<string>>>({
    mains: new Set(),
    subs: new Set(),
    constraints: new Set(),
  });
  const [currentProcessingLabel, setCurrentProcessingLabel] = useState<string>('');
  // Persisted artifacts across runs for incremental assemble
  const [artifactStore, setArtifactStore] = useState<any | null>(null);
  // Track pending renames to relocate artifacts keys between normalized paths
  const [pendingRenames, setPendingRenames] = useState<Array<{ from: string; to: string }>>([]);

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
    try { console.log('[DDT][Wizard][step] → loading'); } catch {}
    setErrorMsg(null);
    try {
        const reqBody = userDesc.trim();
        // Clean path via Vite proxy
        const urlPrimary = `/step2`;
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        console.log('[DDT][DetectType][request]', { url: urlPrimary, body: reqBody });
        const ctrl = new AbortController();
        const timeoutMs = 15000;
        const timeoutId = setTimeout(() => { try { ctrl.abort(); console.warn('[DDT][DetectType][timeout]', { url: urlPrimary, timeoutMs }); } catch {} }, timeoutMs);
        let res = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody),
          signal: ctrl.signal as any,
      });
        clearTimeout(timeoutId);
      const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      let raw = '';
      try { raw = await res.clone().text(); } catch {}
      console.log('[DDT][DetectType][response]', { status: res.status, ok: res.ok, ms: Math.round(elapsed), preview: (raw || '').slice(0, 400) });
      if (!res.ok) throw new Error('Errore comunicazione IA');
      const result = await res.json();
      console.log('[DDT][DetectType][parsed]', result);
      const ai = result.ai || result;
      const schema = ai.schema;
      console.log('[DDT][DetectType][schema]', schema);
      if (schema && Array.isArray(schema.mainData)) {
        const root = schema.label || 'Data';
        const mains0: SchemaNode[] = (schema.mainData || []).map((m: any) => {
          const label = m.label || m.name || 'Field';
          let type = m.type;
          // Canonicalize type at fallback: map Telephone/Phone to 'phone'
          if (!type || type === 'object') {
            const l = String(label).toLowerCase();
            if (/phone|telephone|tel|cellulare|mobile/.test(l)) type = 'phone' as any;
          }
          return {
            label,
            type,
            icon: m.icon,
            subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({ label: s.label || s.name || 'Field', type: s.type, icon: s.icon })) : [],
          } as any;
        });
      setDetectTypeIcon(ai.icon || null);
        // Enrich constraints immediately, then show structure step
        console.log('[DDT][DetectType] → enrichConstraints', { root, mainsCount: mains0.length });
        const enrichedRes = await enrichConstraintsFor(root, mains0);
        console.log('[DDT][DetectType][enrich.done]', enrichedRes);
        const finalRoot = (enrichedRes && (enrichedRes as any).label) ? (enrichedRes as any).label : root;
        let finalMains: any[] = (enrichedRes && (enrichedRes as any).mains) ? (enrichedRes as any).mains as any[] : mains0 as any[];
        // If AI returned multiple atomic mains (no subData), wrap them into a single aggregator main using the root label
        const allAtomic = Array.isArray(finalMains) && finalMains.length > 1 && finalMains.every((m: any) => !Array.isArray((m as any)?.subData) || (m as any).subData.length === 0);
        if (allAtomic) {
          finalMains = [{ label: finalRoot, type: 'object', icon: 'Folder', subData: finalMains }];
          console.log('[DDTWizard] Wrapped atomic mains into aggregator:', finalRoot, 'count', finalMains[0].subData.length);
        }
        setSchemaRootLabel(finalRoot);
        setSchemaMains(finalMains);
        setStep('structure');
        try { console.log('[DDT][Wizard][step] → structure', { root: finalRoot, mains: finalMains.length }); } catch {}
        return;
      }
      console.warn('[DDT][DetectType][invalidSchema]', { schema });
      throw new Error('Schema non valido');
    } catch (err: any) {
      console.error('[DDT][Wizard][error]', err);
      const msg = (err && (err.name === 'AbortError' || err.message === 'The operation was aborted.')) ? 'Timeout step2' : (err.message || '');
      setErrorMsg('Errore IA: ' + msg);
      setStep('error');
      try { console.log('[DDT][Wizard][step] → error'); } catch {}
    }
  };

  // removed old continue

  const enrichConstraintsFor = async (rootLabelIn: string, mainsIn: SchemaNode[]) => {
    try {
      const schema = { label: rootLabelIn || 'Data', mains: mainsIn.map((m) => ({ label: m.label, type: m.type, icon: m.icon, subData: (m.subData || []).map(s => ({ label: s.label, type: s.type, icon: s.icon })) })) };
      const res = await fetch(`/step3`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schema)
      });
      if (!res.ok) {
        console.warn('[DDT][Constraints][response.notOk]', { status: res.status });
        return;
      }
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
    setSchemaMains(prev => {
      const next = [...prev, { label: '', type: 'object', subData: [] } as any];
      // auto-select new and enable inline edit
      setSelectedIdx(next.length - 1);
      setAutoEditIndex(next.length - 1);
      // change tracking
      try { setChanges(p => ({ ...p, mains: new Set([...p.mains, '']) })); } catch {}
      return next;
    });
  };

  const handleChangeEvent = (e: { type: string; path: string; payload?: any }) => {
    setChanges(prev => {
      const next = {
        mains: new Set(prev.mains),
        subs: new Set(prev.subs),
        constraints: new Set(prev.constraints),
      };
      const addOnce = (set: Set<string>, v?: string) => { if (v && v.trim()) set.add(v); };
      if (e.type.startsWith('sub.')) { addOnce(next.subs, e.path); addOnce(next.subs, e.payload?.oldPath); }
      if (e.type.startsWith('constraint.')) { addOnce(next.constraints, e.path); }
      if (e.type.startsWith('main.')) { addOnce(next.mains, e.path); addOnce(next.mains, e.payload?.oldPath); }
      return next;
    });
    // If rename, record from/to normalized paths so we can move artifacts on refine
    if (e.type === 'main.renamed') {
      const from = (e.payload?.oldPath || '').replace(/\//g, '-');
      const to = (e.path || '').replace(/\//g, '-');
      if (from && to && from !== to) setPendingRenames(list => [...list, { from, to }]);
    }
    if (e.type === 'sub.renamed') {
      const old = String(e.payload?.oldPath || '');
      const neu = String(e.path || '');
      const from = old.split('/').map(p => p.replace(/\//g, '-')).join('/');
      const to = neu.split('/').map(p => p.replace(/\//g, '-')).join('/');
      if (from && to && from !== to) setPendingRenames(list => [...list, { from, to }]);
    }
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
    // Gestione tastiera: up/down per selezione
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setSelectedIdx((prev) => Math.min(schemaMains.length - 1, prev + 1));
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIdx((prev) => Math.max(0, prev - 1));
        e.preventDefault();
      }
    };
    return (
      <div style={{ padding: 16 }}>
        <div tabIndex={0} onKeyDown={handleKeyDown} style={{ outline: 'none' }}>
          <MainDataCollection
            rootLabel={schemaRootLabel || 'Data'}
            mains={schemaMains}
            onChangeMains={setSchemaMains}
            onAddMain={handleAddMain}
            progressByPath={{ ...progressByPath, __root__: rootProgress }}
            selectedIdx={selectedIdx}
            onSelect={setSelectedIdx}
            autoEditIndex={autoEditIndex}
            onChangeEvent={handleChangeEvent}
          />
        </div>
        {isProcessing && currentProcessingLabel && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0ea5e9' }}>
              <span style={{ display: 'inline-flex', animation: 'spin 1.2s linear infinite' }}>
                <Hourglass size={16} color="#0ea5e9" />
              </span>
              <span style={{ fontWeight: 600 }}>{currentProcessingLabel}<AnimatedDots /></span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => {
              const v = !playChime;
              setPlayChime(v);
              try { localStorage.setItem('ddtWizard.playChime', v ? '1' : '0'); } catch {}
            }}
            title={playChime ? 'Disable chime on completion' : 'Enable chime on completion'}
            aria-label="Toggle chime on completion"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              border: `1px solid ${playChime ? '#0ea5e9' : '#475569'}`,
              color: playChime ? '#0ea5e9' : '#64748b',
              background: 'transparent',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <Bell size={16} color={playChime ? '#0ea5e9' : '#64748b'} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('input')} style={{ background: 'transparent', color: '#fb923c', border: '1px solid #7c2d12', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => handleClose()} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={async () => {
                if (isProcessing) return;
                setIsProcessing(true);
                // Build plan and totals (switch a refine incrementale in base a changes)
                const hasIncremental = changes.mains.size > 0 || changes.subs.size > 0 || changes.constraints.size > 0;
                const plan = hasIncremental ? buildPartialPlanForChanges(schemaMains as any, changes as any) : buildStepPlan(schemaMains);
                // Nota: per brevità qui non implemento buildPartialPlanForChanges; placeholder: quando hasIncremental sarà true, costruiremo solo gli step necessari
                const total: Record<string, number> = {};
                const done: Record<string, number> = {};
                for (const s of plan) { total[s.path] = (total[s.path] || 0) + 1; }
                setTotalByPath(total);
                setProgressByPath({});

                const API_BASE = '';
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
                    const prettyPath = step.path.replace(/-/g, ' ');
                    const mapType = (t: string) => {
                      switch (t) {
                        case 'start': return 'creando gli start prompts';
                        case 'noMatch': return 'creando i no match prompts';
                        case 'noInput': return 'creando i no input prompts';
                        case 'confirmation': return 'creando i confirmation prompts';
                        case 'notConfirmed': return 'creando i not confirmed prompts';
                        case 'success': return 'creando i success prompts';
                        case 'constraintMessages': return 'creando i messaggi di violazione vincoli';
                        case 'validator': return 'generando il validator';
                        case 'testset': return 'generando il test set';
                        default: return 'processing';
                      }
                    };
                    const msg = `${mapType(step.type)} per ${prettyPath}`;
                    setCurrentProcessingLabel(msg.charAt(0).toUpperCase() + msg.slice(1));
                    if (step.type === 'constraintMessages') {
                      const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter((c: any) => c && c.kind !== 'required') };
                      const res = await fetch(`/api/constraintMessages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                      results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
                    } else if (step.type === 'validator') {
                      const body = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter((c: any) => c && c.kind !== 'required') };
                      const res = await fetch(`/api/validator`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                      results.push({ step: { path: step.path, type: step.type, constraintKind: step.constraintKind }, payload: await res.json() });
                    } else if (step.type === 'testset') {
                      const datumBody = { label: datum.label, type: datum.type, constraints: (datum.constraints || []).filter((c: any) => c && c.kind !== 'required') };
                      const res = await fetch(`/api/testset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ datum: datumBody, notes: [] }) });
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
                        const res = await fetch(`${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meaning, desc: '' }) });
                        results.push({ step: { path: step.path, type: step.type }, payload: await res.json() });
                      }
                    }
                  } finally {
                    // Auto-select main in processing
                    try {
                      const mainLabel = parts[0];
                      const idx = schemaMains.findIndex(m => norm(m.label) === mainLabel);
                      if (idx !== -1) setSelectedIdx(idx);
                    } catch {}
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
                // Build delta store and merge into persisted store
                const deltaStore = buildArtifactStore(results);
                let merged = mergeArtifactStores(artifactStore, deltaStore);
                // Apply pending path moves due to rename events
                if (pendingRenames.length > 0) {
                  for (const { from, to } of pendingRenames) {
                    merged = moveArtifactsPath(merged, from, to);
                  }
                }
                setArtifactStore(merged);
                // Clear processed changes and renames after incremental refine
                if (hasIncremental) {
                  setChanges({ mains: new Set(), subs: new Set(), constraints: new Set() });
                  setPendingRenames([]);
                }
                const finalDDT = await assembleFinalDDT(schemaRootLabel || 'Data', schemaMains, merged);
                // optional chime to signal completion
                if (playChime) {
                  try {
                    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const o = audioCtx.createOscillator();
                    const g = audioCtx.createGain();
                    o.type = 'sine';
                    o.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
                    g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
                    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
                    o.connect(g);
                    g.connect(audioCtx.destination);
                    o.start();
                    o.stop(audioCtx.currentTime + 0.35);
                  } catch (_) {
                    // ignore audio errors (e.g., autoplay restrictions)
                  }
                }
                // chiudi wizard e notifica il parent per aggiornare lista e aprire editor
                if (onComplete) {
                  onComplete(finalDDT);
                }
                setClosed(true);
              }}
              disabled={isProcessing}
              style={{ background: isProcessing ? '#fbbf24' : '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: isProcessing ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={() => {/* could compute tooltip count here */}}
              title={(changes.mains.size + changes.subs.size + changes.constraints.size) > 0 ? `Refine ${changes.mains.size + changes.subs.size + changes.constraints.size} items` : ''}
            >
              {isProcessing ? (
                <span
                  style={{
                    fontWeight: 700
                  }}
                >
                  Processing…
                </span>
              ) : (
                (changes.mains.size > 0 || changes.subs.size > 0 || changes.constraints.size > 0) ? 'Refine' : 'Continue'
              )}
            </button>
          </div>
        </div>
        <V2TogglePanel />
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