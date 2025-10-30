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
import { taskCounter } from '../../../utils/TaskCounter';
import { PlanRunResult } from './planRunner';
import { buildArtifactStore, mergeArtifactStores, moveArtifactsPath } from './artifactStore';
import { assembleFinalDDT } from './assembleFinal';
import { Hourglass, Bell } from 'lucide-react';
import { debug, error } from '../../../utils/logger';
// ResponseEditor will be opened by sidebar after onComplete

// 🚀 NEW: Interface for field processing state
interface FieldProcessingState {
  fieldId: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  timestamp: Date;
}

// DEBUG (toggle)
const __DEBUG_DDT_UI__ = false;
const dlog = (...a: any[]) => { if (__DEBUG_DDT_UI__) debug('DDT_WIZARD', a.join(' ')); };

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

// Auto-Mapping Service (inline to avoid import issues)
interface FieldAnalysis {
  fieldLabel: string;
  analysis: {
    action: 'use_existing' | 'compose' | 'create_new';
    template_source?: string;
    composed_from?: string[];
    mains?: Array<{
      label: string;
      type: string;
      icon: string;
      subData: Array<{
        label: string;
        type: string;
        icon: string;
        validation?: any;
      }>;
    }>;
  };
  provider_used: string;
  timestamp: string;
}

interface TemplateInfo {
  label: string;
  type: string;
  icon: string;
  subData: Array<{
    label: string;
    type: string;
    icon: string;
  }>;
}

class AutoMappingService {
  private templates: TemplateInfo[] = [];

  async initializeTemplates(): Promise<void> {
    try {
      const response = await fetch('/api/factory/dialogue-templates');
      if (response.ok) {
        const data = await response.json();
        this.templates = data.templates || [];
        debug('DDT_WIZARD', 'Loaded templates', { count: this.templates.length });
      }
    } catch (error) {
      console.warn('[AUTO_MAPPING] Failed to load templates:', error);
    }
  }

  async analyzeField(fieldLabel: string, provider: 'openai' | 'groq' = 'openai'): Promise<FieldAnalysis | null> {
    try {
      console.log('[AUTO_MAPPING] Analyzing field:', fieldLabel);

      const response = await fetch('/api/analyze-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldLabel, provider })
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('[AUTO_MAPPING] Analysis result:', result.analysis.action);

      return result;
    } catch (error) {
      console.warn('[AUTO_MAPPING] Analysis failed:', error);
      return null;
    }
  }

  async getSuggestedStructure(fieldLabel: string, provider: 'openai' | 'groq' = 'openai'): Promise<TemplateInfo | null> {
    const analysis = await this.analyzeField(fieldLabel, provider);

    if (!analysis) return null;

    if (analysis.analysis.action === 'use_existing' && analysis.analysis.template_source) {
      const template = this.templates.find(t =>
        t.label.toLowerCase().includes(analysis.analysis.template_source!.toLowerCase()) ||
        analysis.analysis.template_source!.toLowerCase().includes(t.label.toLowerCase())
      );

      if (template) {
        console.log('[AUTO_MAPPING] Found matching template:', template.label);
        return template;
      }
    }

    if (analysis.analysis.action === 'create_new' && analysis.analysis.mains?.[0]) {
      const main = analysis.analysis.mains[0];
      return {
        label: main.label,
        type: main.type,
        icon: main.icon,
        subData: main.subData.map(sub => ({
          label: sub.label,
          type: sub.type,
          icon: sub.icon
        }))
      };
    }

    return null;
  }

  shouldAutoMap(fieldLabel: string): boolean {
    const lowerLabel = fieldLabel.toLowerCase();
    const autoMapPatterns = [
      'data', 'date', 'giorno', 'mese', 'anno',
      'nome', 'cognome', 'nominativo',
      'indirizzo', 'via', 'città', 'cap',
      'telefono', 'phone', 'cellulare',
      'email', 'mail',
      'codice', 'code', 'id'
    ];
    return autoMapPatterns.some(pattern => lowerLabel.includes(pattern));
  }
}

const autoMappingService = new AutoMappingService();

const DDTWizard: React.FC<{ onCancel: () => void; onComplete?: (newDDT: any, messages?: any) => void; initialDDT?: any; startOnStructure?: boolean; onSeePrompts?: () => void }> = ({ onCancel, onComplete, initialDDT, startOnStructure, onSeePrompts }) => {
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
    } catch { }
  }, []);
  // Initialize auto-mapping service
  useEffect(() => {
    autoMappingService.initializeTemplates();
  }, []);

  const [step, setStep] = useState<string>(startOnStructure ? 'structure' : 'input');

  // Auto-mapping function for manually added fields
  const autoMapFieldStructure = async (fieldLabel: string, fieldIndex: number) => {
    try {
      console.log('[AUTO_MAPPING] Auto-mapping field:', fieldLabel);

      // Check if field should be auto-mapped
      if (!autoMappingService.shouldAutoMap(fieldLabel)) {
        console.log('[AUTO_MAPPING] Field does not need auto-mapping:', fieldLabel);
        return;
      }

      // Get suggested structure
      const suggestedStructure = await autoMappingService.getSuggestedStructure(fieldLabel, selectedProvider.toLowerCase());

      if (suggestedStructure && suggestedStructure.subData.length > 0) {
        console.log('[AUTO_MAPPING] Applying structure:', suggestedStructure.subData.length, 'sub-fields');

        // Update the field with suggested structure
        setSchemaMains(prev =>
          prev.map((m, index) =>
            index === fieldIndex
              ? {
                ...m,
                type: suggestedStructure.type,
                icon: suggestedStructure.icon,
                subData: suggestedStructure.subData.map(sub => ({
                  label: sub.label,
                  type: sub.type,
                  icon: sub.icon,
                  constraints: [] // TODO: Implement proper validation constraints later
                }))
              }
              : m
          )
        );

        console.log('[AUTO_MAPPING] ✅ Auto-mapping completed for:', fieldLabel);
      } else {
        console.log('[AUTO_MAPPING] No suitable structure found for:', fieldLabel);
      }
    } catch (error) {
      console.warn('[AUTO_MAPPING] Auto-mapping failed for:', fieldLabel, error);
    }
  };
  const [userDesc, setUserDesc] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'groq'>('groq');
  const [detectTypeIcon, setDetectTypeIcon] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataNode] = useState<DataNode | null>(() => ({ name: initialDDT?.label || '' }));
  const [closed, setClosed] = useState(false);

  // Auto-detect function for real-time AI analysis
  const handleAutoDetect = React.useCallback(async (text: string) => {
    if (step === 'pipeline' || closed || !text.trim()) return;

    debug('DDT_WIZARD', 'Starting auto-detection', { text, step, closed, textLength: text.trim().length });

    try {
      const urlPrimary = `/step2-with-provider`;
      debug('DDT_WIZARD', 'Making API call', { url: urlPrimary });

      const response = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDesc: text.trim(), provider: selectedProvider.toLowerCase() }),
      });

      debug('DDT_WIZARD', 'API response received', { status: response.status, ok: response.ok, statusText: response.statusText });

      if (!response.ok) {
        error('DDT_WIZARD', 'API call failed', { status: response.status });
        return;
      }

      const result = await response.json();
      debug('DDT_WIZARD', 'Parsed result', result);

      const ai = result.ai || result;
      debug('DDT_WIZARD', 'AI data', { action: ai.action, label: ai.label, mainsCount: ai.mains?.length || 0 });

      // If AI suggests a specific template, show preview
      if (ai.action === 'use_existing' || ai.action === 'compose') {
        debug('DDT_WIZARD', 'Template detected', { template_source: ai.template_source, composed_from: ai.composed_from });
        // You could show a preview tooltip here
      }

    } catch (error) {
      error('DDT_WIZARD', 'Auto-detect error', error);
    }
  }, [step, closed, selectedProvider]);
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
  // 🚀 REPLACED: progressByPath con TaskCounter
  const [taskProgress, setTaskProgress] = useState<Record<string, number>>({});
  const [rootProgress, setRootProgress] = useState<number>(0);

  // 🚀 NEW: State for field processing states
  const [fieldProcessingStates, setFieldProcessingStates] = useState<Record<string, FieldProcessingState>>({});
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
  // Parallel processing: accumulate partial DDT results for each main
  const [partialResults, setPartialResults] = useState<Record<number, any>>({});
  // Ref to track when all mains are completed and we should close
  const pendingCloseRef = React.useRef<{ ddt: any; translations: any } | null>(null);
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

  // Two-panel layout: show results panel at right after user clicks Continue on the left
  const [showRight, setShowRight] = useState<boolean>(startOnStructure ? true : false);

  // Auto-collapse/expand: quando un main data raggiunge 100%, passa automaticamente al successivo
  useEffect(() => {
    if (step !== 'pipeline') return;
    if (schemaMains.length === 0) return;

    const currentMain = schemaMains[selectedIdx];
    if (!currentMain) return;

    const currentMainProgress = taskProgress[currentMain.label] || 0;

    // Se il main corrente ha raggiunto 100%, cerca il prossimo non completato
    if (currentMainProgress >= 0.99) { // 0.99 per tolleranza float
      const nextIdx = schemaMains.findIndex((m, i) =>
        i > selectedIdx && (taskProgress[m.label] || 0) < 0.99
      );

      if (nextIdx !== -1) {
        // Auto-espandi il prossimo main data
        try {
          console.log(`[DDT][auto-advance] ${currentMain.label} completed (${Math.round(currentMainProgress * 100)}%) → opening ${schemaMains[nextIdx].label}`);
        } catch { }
        setSelectedIdx(nextIdx);
      }
    }
  }, [taskProgress, selectedIdx, schemaMains, step]);

  // Effect to handle closing when all mains are completed
  React.useEffect(() => {
    if (pendingCloseRef.current && schemaMains.length > 0) {
      const completedCount = Object.keys(partialResults).length;
      // Only close if all mains are completed
      if (completedCount === schemaMains.length) {
        const { ddt, translations } = pendingCloseRef.current;
        pendingCloseRef.current = null; // Clear before calling to avoid re-triggering
        // Use setTimeout to defer to next tick, avoiding setState during render
        setTimeout(() => {
          handleClose(ddt, translations);
        }, 0);
      }
    }
  }, [partialResults, schemaMains.length]);

  // DataNode stabile per pipeline (evita rilanci causati da oggetti inline)
  const pipelineDataNode = React.useMemo(() => {
    const main0 = schemaMains[selectedIdx] || schemaMains[0] || ({} as any);
    return {
      name: (main0 as any)?.label || 'Data',
      type: (main0 as any)?.type,
      subData: ((main0 as any)?.subData || []) as any[],
    } as any;
  }, [schemaMains, selectedIdx]);

  // Funzione per chiamare la detection AI
  const handleDetectType = async () => {
    if (step === 'pipeline' || closed) return; // Blocca ogni setState durante la pipeline
    setShowRight(true);
    setStep('loading');
    try { dlog('[DDT][UI] step → loading'); } catch { }
    setErrorMsg(null);
    try {
      const reqBody = userDesc.trim();
      console.log('[DDT][DetectType] 🚀 Starting detection for:', reqBody);
      console.log('[DDT][DetectType] 📊 Current state:', { step, closed, userDesc: reqBody });

      // Clean path via Vite proxy
      const urlPrimary = `/step2-with-provider`;
      const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      console.log('[DDT][DetectType][request]', { url: urlPrimary, body: reqBody, provider: selectedProvider, providerLower: selectedProvider.toLowerCase() });
      const ctrl = new AbortController();
      const timeoutMs = 60000; // 60 seconds - increased for enterprise AI
      const timeoutId = setTimeout(() => { try { ctrl.abort(); console.warn('[DDT][DetectType][timeout]', { url: urlPrimary, timeoutMs }); } catch { } }, timeoutMs);
      let res = await fetch(urlPrimary, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userDesc: reqBody, provider: selectedProvider.toLowerCase() }),
        signal: ctrl.signal as any,
      });
      clearTimeout(timeoutId);
      const elapsed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - t0;
      let raw = '';
      try { raw = await res.clone().text(); } catch { }
      console.log('[DDT][DetectType][response]', { status: res.status, ok: res.ok, ms: Math.round(elapsed), preview: (raw || '').slice(0, 400) });
      if (!res.ok) throw new Error('Errore comunicazione IA');
      const result = await res.json();
      console.log('[DDT][DetectType][parsed]', result);
      const ai = result.ai || result;

      console.log('[DDT][DetectType] 🤖 AI Response analysis:', {
        action: ai.action,
        label: ai.label,
        type: ai.type,
        icon: ai.icon,
        mainsCount: ai.mains?.length || 0,
        hasValidation: ai.mains?.some(m => m.validation) || false,
        hasExamples: ai.mains?.some(m => m.example) || false,
        hasSchema: !!ai.schema,
        schemaMainDataCount: ai.schema?.mainData?.length || 0
      });

      // Handle new AI response structure
      let schema;
      if (ai.schema && Array.isArray(ai.schema.mainData)) {
        // Old structure: ai.schema.mainData
        schema = ai.schema;
        console.log('[DDT][DetectType] 📋 Using schema.mainData structure');
      } else if (Array.isArray(ai.mains)) {
        // New structure: ai.mains directly
        schema = {
          label: ai.label || 'Data',
          mainData: ai.mains
        };
        console.log('[DDT][DetectType] 📋 Using ai.mains structure');
      } else {
        throw new Error('Schema non valido');
      }

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
            constraints: [], // TODO: Implement proper validation constraints later
            subData: Array.isArray(m.subData) ? m.subData.map((s: any) => ({
              label: s.label || s.name || 'Field',
              type: s.type,
              icon: s.icon,
              constraints: [] // TODO: Implement proper validation constraints later
            })) : [],
          } as any;
        });
        setDetectTypeIcon(ai.icon || null);
        // Enrich constraints immediately, then show structure step
        console.log('[DDT][DetectType] → enrichConstraints', { root, mainsCount: mains0.length });
        const enrichedRes = await enrichConstraintsFor(root, mains0);
        console.log('[DDT][DetectType][enrich.done]', enrichedRes);
        const finalRoot = (enrichedRes && (enrichedRes as any).label) ? (enrichedRes as any).label : root;
        let finalMains: any[] = (enrichedRes && (enrichedRes as any).mains) ? (enrichedRes as any).mains as any[] : mains0 as any[];
        // Fallback: se nessuna subData proposta, inferisci dal testo utente
        try {
          const inferred = inferSubDataFromText(userDesc);
          if (Array.isArray(finalMains) && finalMains.length > 0 && (!finalMains[0].subData || finalMains[0].subData.length === 0) && inferred.length > 0) {
            finalMains = [{ ...finalMains[0], subData: inferred }];
          }
        } catch { }
        // If AI returned multiple atomic mains (no subData), wrap them into a single aggregator main using the root label
        const allAtomic = Array.isArray(finalMains) && finalMains.length > 1 && finalMains.every((m: any) => !Array.isArray((m as any)?.subData) || (m as any).subData.length === 0);
        if (allAtomic) {
          finalMains = [{ label: finalRoot, type: 'object', icon: 'Folder', subData: finalMains }];
          debug('DDT_WIZARD', 'Wrapped atomic mains into aggregator', { finalRoot, count: finalMains[0].subData.length });
        }
        setSchemaRootLabel(finalRoot);
        setSchemaMains(finalMains);
        setStep('structure');
        try { dlog('[DDT][UI] step → structure', { root: finalRoot, mains: finalMains.length }); } catch { }
        return;
      }
      console.warn('[DDT][DetectType][invalidSchema]', { schema });
      throw new Error('Schema non valido');
    } catch (err: any) {
      console.error('[DDT][Wizard][error]', err);
      const msg = (err && (err.name === 'AbortError' || err.message === 'The operation was aborted.')) ? 'Timeout step2' : (err.message || '');
      setErrorMsg('Errore IA: ' + msg);
      setStep('error');
      try { dlog('[DDT][UI] step → error'); } catch { }
    }
  };

  // removed old continue

  // Assembla un DDT minimale dalla struttura corrente (root + mains + subData)
  const assembleMinimalDDT = () => {
    const root = (schemaRootLabel || 'Data');
    const mains = (schemaMains || []).map((m) => ({
      label: m.label || 'Field',
      type: m.type,
      icon: (m as any).icon,
      constraints: (m as any).constraints,
      subData: (m.subData || []).map((s) => ({
        label: s.label || 'Field',
        type: s.type,
        icon: (s as any).icon,
        constraints: (s as any).constraints,
      }))
    }));
    // preserva id/_id e translations dall'initialDDT per evitare rimbalzi
    const baseId = (initialDDT as any)?.id || (initialDDT as any)?._id;
    const ddt = {
      ...(baseId ? { id: (initialDDT as any)?.id || baseId } : {}),
      ...(((initialDDT as any)?._id && !(initialDDT as any)?.id) ? { _id: (initialDDT as any)._id } : {}),
      label: root,
      mainData: mains,
      ...(initialDDT && (initialDDT as any).translations ? { translations: (initialDDT as any).translations } : {}),
    } as any;
    try {
      debug('DDT_WIZARD', 'Assembling DDT', { root, mainsCount: mains.length, mainsLabels: mains.map(m => m.label), preservedId: baseId });
    } catch { }
    return ddt;
  };

  // Heuristic: infer simple subData list from user description when AI doesn't provide it
  function inferSubDataFromText(text: string): Array<{ label: string; type?: string; icon?: string }> {
    try {
      const t = (text || '').toLowerCase();
      const out: Array<{ label: string; type?: string; icon?: string }> = [];
      const add = (label: string, type?: string) => {
        if (!out.some(x => x.label.toLowerCase() === label.toLowerCase())) out.push({ label, type });
      };
      if (/country\s*code|prefisso\s*internazionale/.test(t)) add('Country code', 'string');
      if (/area\s*code|prefisso\s*area|prefisso\s*citt[aà]/.test(t)) add('Area code', 'string');
      if (/\bnumber|numero\b/.test(t)) add('Number', 'string');
      return out;
    } catch {
      return [];
    }
  }

  const enrichConstraintsFor = async (rootLabelIn: string, mainsIn: SchemaNode[]) => {
    try {
      const schema = { label: rootLabelIn || 'Data', mains: mainsIn.map((m) => ({ label: m.label, type: m.type, icon: m.icon, subData: (m.subData || []).map(s => ({ label: s.label, type: s.type, icon: s.icon })) })), text: userDesc };
      try { console.log('[DDT][Constraints][request]', { url: '/step3', body: schema }); } catch { }
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
              // usa SOLO i constraints restituiti dall'AI; niente fallback locali
              return { ...sub, constraints: Array.isArray(es?.constraints) ? es.constraints : [] };
            });
          }
          // Dedupe helper
          const dedupe = (arr?: any[]) => {
            const seen = new Set<string>();
            const out: any[] = [];
            for (const c of (arr || [])) {
              const k = JSON.stringify({ t: (c as any)?.title || '', p: (c as any)?.payoff || '' }).toLowerCase();
              if (!seen.has(k)) { seen.add(k); out.push(c); }
            }
            return out;
          };
          // Usa SOLO i constraints restituiti dall'AI anche per il main
          const mainConstraints = Array.isArray(em?.constraints) ? dedupe(em!.constraints) : [];
          // Dedupe per i sub
          nextSub = nextSub.map(s => ({ ...s, constraints: dedupe((s as any).constraints) }));
          return { ...existing, constraints: mainConstraints, subData: nextSub };
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
      try { setChanges(p => ({ ...p, mains: new Set([...p.mains, '']) })); } catch { }
      return next;
    });
  };

  const handleChangeEvent = (e: { type: string; path: string; payload?: any }) => {
    console.log('[DDT_WIZARD] 🔔 handleChangeEvent called:', {
      type: e.type,
      path: e.path,
      payload: e.payload
    });

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
    debug('DDT_WIZARD', 'Handle close', { hasResult: !!result, hasOnComplete: !!onComplete, resultId: result?.id, resultLabel: result?.label, mainsCount: Array.isArray(result?.mainData) ? result.mainData.length : 'not-array' });
    setClosed(true);
    if (result && onComplete) {
      debug('DDT_WIZARD', 'Calling onComplete callback');
      onComplete(result, messages);
    } else {
      debug('DDT_WIZARD', 'Calling onCancel');
      onCancel();
    }
  };

  // Se chiuso, non renderizzare nulla
  if (closed) return null;

  // Two-panel layout render (simplified, as requested)
  const rightHasContent = Boolean(
    showRight && (
      step === 'loading' ||
      (step === 'structure' && Array.isArray(schemaMains) && schemaMains.length > 0) ||
      step === 'pipeline' || step === 'error' || step === 'support'
    )
  );
  const pipelineHeadless = true; // run pipeline headlessly; show progress under structure
  const renderTogglePanel = step !== 'pipeline';
  try { dlog('[DDT][UI] render', { step, showRight, rightHasContent, pipelineHeadless, renderTogglePanel }); } catch { }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: rightHasContent ? 'minmax(420px,520px) 1fr' : '1fr',
        gap: 12,
        height: '100%',
      }}
    >
      <div style={{ overflow: 'auto', padding: '0 8px' }}>
        <WizardInputStep
          userDesc={userDesc}
          setUserDesc={setUserDesc}
          onNext={handleDetectType}
          onCancel={handleClose}
          dataNode={stableDataNode || undefined}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          onAutoDetect={handleAutoDetect}
        />
      </div>

      {rightHasContent && (
        <div style={{ overflow: 'auto', borderLeft: '1px solid #1f2340', padding: 12 }}>
          {step === 'loading' && <WizardLoadingStep />}

          {step === 'error' && (
            <WizardErrorStep
              errorMsg={errorMsg}
              onRetry={handleDetectType}
              onSupport={() => setStep('support')}
              onCancel={handleClose}
            />
          )}

          {(step === 'structure' || step === 'pipeline') && (
            <div style={{ padding: 4 }}>
              <div tabIndex={0} style={{ outline: 'none' }}>
                <MainDataCollection
                  rootLabel={schemaRootLabel || 'Data'}
                  mains={schemaMains}
                  onChangeMains={setSchemaMains}
                  onAddMain={handleAddMain}
                  progressByPath={{ ...taskProgress, __root__: rootProgress }}
                  fieldProcessingStates={fieldProcessingStates}
                  selectedIdx={selectedIdx}
                  onSelect={setSelectedIdx}
                  autoEditIndex={autoEditIndex}
                  onChangeEvent={handleChangeEvent}
                  onAutoMap={autoMapFieldStructure}
                />
              </div>
              {step === 'structure' && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button onClick={handleClose} style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #475569', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}>Cancel</button>
                  <button
                    onClick={() => {
                      console.log(`[DDTWizard] Build Messages button clicked! Current step: ${step}`);
                      try { dlog('[DDT][UI] step → pipeline'); } catch { }
                      console.log(`[DDTWizard] Setting step to pipeline, current step: ${step}`);
                      // Avvia pipeline generativa mantenendo visibile la struttura (progress in-place)
                      setShowRight(true);
                      // reset progress state to avoid stale 100%
                      setTaskProgress({});
                      setRootProgress(0);
                      setPartialResults({}); // Reset parallel processing results
                      // Apri il primo main data
                      setSelectedIdx(0);
                      setStep('pipeline');
                      console.log(`[DDTWizard] Step set to pipeline`);
                    }}
                    style={{ background: '#22c55e', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Build Messages
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'pipeline' && (
            <div style={{ position: 'relative' }}>
              {schemaMains.map((mainItem, mainIdx) => {
                const mainDataNode = {
                  name: (mainItem as any)?.label || 'Data',
                  label: (mainItem as any)?.label || 'Data',  // ← ADD: label for DDT assembly
                  type: (mainItem as any)?.type,
                  icon: (mainItem as any)?.icon,              // ← ADD: icon for proper display
                  subData: ((mainItem as any)?.subData || []) as any[],
                };

                return (
                  <div
                    key={`pipeline-${mainIdx}-${mainItem.label}`}
                    style={{
                      display: mainIdx === selectedIdx ? 'block' : 'none'
                    }}
                  >
                    <WizardPipelineStep
                      headless={pipelineHeadless}
                      dataNode={mainDataNode}
                      detectTypeIcon={(mainItem as any)?.icon || detectTypeIcon}
                      onCancel={() => setStep('structure')}
                      skipDetectType
                      confirmedLabel={mainDataNode?.name || 'Data'}
                      selectedProvider={selectedProvider}
                      onProgress={(m) => {
                        const mainLabel = mainItem.label;
                        // Update individual main progress
                        const mainProgress = typeof (m as any)?.[mainLabel] === 'number' ? (m as any)[mainLabel] : 0;

                        setTaskProgress((prev) => {
                          const updated = { ...(prev || {}), ...(m || {}) };
                          // Calculate overall root progress (average of all mains)
                          const allProgress = schemaMains.map(m => updated[m.label] || 0);
                          const avgProgress = allProgress.reduce((sum, p) => sum + p, 0) / schemaMains.length;
                          updated.__root__ = avgProgress;
                          return updated;
                        });

                        setRootProgress((prev) => {
                          // 🎯 CORRETTO: Usa TaskCounter per calcolare task completati/totali
                          const mainDataArray = schemaMains.map(m => ({
                            label: m.label,
                            subData: (m.subData || []).map(s => ({ label: s.label }))
                          }));

                          const progressMap = taskCounter.calculateRecursiveProgress(mainDataArray);
                          console.log('[DDTWizard] TaskCounter progress calculation:', {
                            mainDataArray,
                            progressMap,
                            rootProgress: progressMap.__root__
                          });
                          return progressMap.__root__ || 0;
                        });
                      }}
                      onComplete={(partialDDT) => {
                        console.log(`[DDT][Wizard][parallel] Main ${mainIdx + 1}/${schemaMains.length} completed:`, {
                          mainLabel: mainItem.label,
                          hasDDT: !!partialDDT,
                          mainsCount: Array.isArray(partialDDT?.mainData) ? partialDDT.mainData.length : 'not-array'
                        });

                        // Accumulate partial result
                        setPartialResults(prev => {
                          const updated = { ...prev, [mainIdx]: partialDDT };

                          // Check if all mains completed
                          const completedCount = Object.keys(updated).length;
                          console.log(`[DDT][Wizard][parallel] Progress: ${completedCount}/${schemaMains.length} mains completed`);

                          if (completedCount === schemaMains.length) {
                            // All mains completed - assemble final DDT
                            console.log('[DDT][Wizard][parallel] All mains completed, assembling final DDT...');

                            try {
                              // Merge all mainData from partial results
                              const allMains = schemaMains.map((schemaMain, idx) => {
                                const partial = updated[idx];
                                if (!partial || !partial.mainData || partial.mainData.length === 0) {
                                  console.warn(`[DDT][Wizard][parallel] Missing mainData for idx ${idx}:`, schemaMain.label);
                                  return null;
                                }
                                return partial.mainData[0]; // Each partial has 1 main
                              }).filter(Boolean);

                              // Merge translations
                              const mergedTranslations: any = {};
                              Object.values(updated).forEach((partial: any) => {
                                if (partial?.translations) {
                                  Object.assign(mergedTranslations, partial.translations);
                                }
                              });

                              const finalDDT = {
                                id: schemaRootLabel || 'Data',
                                label: schemaRootLabel || 'Data',
                                mainData: allMains,
                                translations: mergedTranslations,
                                _fromWizard: true  // Flag to identify wizard-generated DDTs
                              };

                              console.log('[DDT][Wizard][parallel] Final DDT assembled:', {
                                id: finalDDT.id,
                                label: finalDDT.label,
                                mainsCount: finalDDT.mainData.length,
                                mainLabels: finalDDT.mainData.map((m: any) => m?.label),
                                translationsCount: Object.keys(mergedTranslations).length
                              });

                              // Preserve _userLabel and _sourceAct
                              if ((dataNode as any)?._userLabel && !(finalDDT as any)._userLabel) {
                                (finalDDT as any)._userLabel = (dataNode as any)._userLabel;
                              }
                              if ((dataNode as any)?._sourceAct) {
                                (finalDDT as any)._sourceAct = (dataNode as any)._sourceAct;
                              }

                              console.log('[DDT][Wizard][parallel] Setting pending close with final DDT');
                              // Store in ref instead of calling handleClose directly
                              pendingCloseRef.current = {
                                ddt: finalDDT,
                                translations: finalDDT.translations || {}
                              };
                            } catch (err) {
                              console.error('[DDT][Wizard][parallel] Failed to assemble final DDT:', err);
                            }
                          }

                          return updated;
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Contenuto “normale” del pannello destro (solo quando non in pipeline) */}
          {(() => { try { dlog('[DDT][UI] render TogglePanel?', { render: renderTogglePanel }); } catch { }; return null; })()}
          {renderTogglePanel && <V2TogglePanel />}
          {/* CTA moved next to Cancel above */}
        </div>
      )}
    </div>
  );
};

export default DDTWizard;